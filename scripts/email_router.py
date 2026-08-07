"""
D4 Insight Email Router
========================
Central email gateway. Fetches all new emails from sysadmin@d4insight.com,
classifies each into exactly ONE agent, and returns them grouped.

This prevents cross-contamination: SOW replies won't hit the leave scanner,
casual leave mentions won't auto-record, timesheet replies stay in their lane.

Classification priority:
  1. Skip own sent emails         → ignore
  2. Thread match (conversationId) → owning agent
  3. Subject pattern (regex rules) → deterministic match
  4. AI classification (Haiku)     → ambiguous fallback

Agents: leave | hiring | timesheet | sow | ignore
"""

import os
import re
import json
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "router_data")
THREAD_REGISTRY_FILE = os.path.join(DATA_DIR, "thread_registry.json")
PROCESSED_FILE = os.path.join(DATA_DIR, "processed_emails.json")

MAX_PROCESSED_AGE_DAYS = 60


# ═══════════════════════════════════════════════════════════════
# THREAD REGISTRY — which agent owns each conversation
# ═══════════════════════════════════════════════════════════════

def _load_thread_registry():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        if os.path.exists(THREAD_REGISTRY_FILE):
            with open(THREAD_REGISTRY_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {}


def _save_thread_registry(registry):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(THREAD_REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=2)


def register_thread(conversation_id, agent, context=""):
    """Register a conversation as owned by a specific agent.
    Call this whenever an agent SENDS an email to create thread ownership."""
    if not conversation_id:
        return
    registry = _load_thread_registry()
    # Don't overwrite existing ownership unless it's "ignore"
    if conversation_id in registry and registry[conversation_id]["agent"] != "ignore":
        return
    registry[conversation_id] = {
        "agent": agent,
        "context": context,
        "registered_at": datetime.now().isoformat(),
    }
    _save_thread_registry(registry)


def get_thread_owner(conversation_id):
    """Look up which agent owns a conversation. Returns agent name or None."""
    if not conversation_id:
        return None
    registry = _load_thread_registry()
    entry = registry.get(conversation_id)
    return entry["agent"] if entry else None


# ═══════════════════════════════════════════════════════════════
# PROCESSED EMAIL TRACKING
# ═══════════════════════════════════════════════════════════════

def _load_processed():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        if os.path.exists(PROCESSED_FILE):
            with open(PROCESSED_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {"ids": {}, "last_cleanup": None}


def _save_processed(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PROCESSED_FILE, "w") as f:
        json.dump(data, f, indent=2)


def mark_processed(email_id, agent):
    """Mark an email as processed by a specific agent."""
    data = _load_processed()
    data["ids"][email_id] = {
        "agent": agent,
        "processed_at": datetime.now().isoformat(),
    }
    # Periodic cleanup of old entries
    last_clean = data.get("last_cleanup")
    if not last_clean or (datetime.now() - datetime.fromisoformat(last_clean)).days > 7:
        cutoff = (datetime.now() - timedelta(days=MAX_PROCESSED_AGE_DAYS)).isoformat()
        data["ids"] = {k: v for k, v in data["ids"].items()
                       if v.get("processed_at", "") > cutoff}
        data["last_cleanup"] = datetime.now().isoformat()
    _save_processed(data)


def is_processed(email_id):
    """Check if an email was already processed by any agent."""
    data = _load_processed()
    return email_id in data["ids"]


def seed_processed_from_hiring(hiring_data_path):
    """One-time migration: seed router's processed list from hiring_tracker.json
    so we don't reprocess old emails on first run."""
    if not os.path.exists(hiring_data_path):
        return 0
    try:
        with open(hiring_data_path) as f:
            hiring = json.load(f)
        old_ids = hiring.get("processed_email_ids", [])
        data = _load_processed()
        count = 0
        for eid in old_ids:
            if eid not in data["ids"]:
                data["ids"][eid] = {
                    "agent": "hiring",
                    "processed_at": datetime.now().isoformat(),
                    "migrated": True,
                }
                count += 1
        _save_processed(data)
        return count
    except Exception:
        return 0


# ═══════════════════════════════════════════════════════════════
# SUBJECT PATTERN RULES (deterministic, checked before AI)
# ═══════════════════════════════════════════════════════════════

SUBJECT_RULES = [
    # SOW approval workflow
    (r'SOW\s+Approval\s+Required', 'sow'),
    (r'RE:\s*SOW\s+Approval', 'sow'),
    (r'SOW[-_]\d{4}[-_]\d+', 'sow'),

    # Timesheet workflow
    (r'Timesheets?\s+for\s+approval', 'timesheet'),
    (r'Timesheet\s+Verification', 'timesheet'),
    (r'Consolidated\s+Timesheet', 'timesheet'),
    (r'\[UPDATED\]\s+Consolidated', 'timesheet'),
    (r'Timesheet\s+Reminder', 'timesheet'),

    # System test emails (ignore)
    (r'VCC\s+Timesheet\s+System\s+Active', 'ignore'),
    (r'^Test\s*[-—]', 'ignore'),
]

_compiled_rules = [(re.compile(pattern, re.IGNORECASE), agent)
                   for pattern, agent in SUBJECT_RULES]


def _classify_by_subject(subject):
    """Try deterministic subject pattern match. Returns agent or None."""
    for pattern, agent in _compiled_rules:
        if pattern.search(subject):
            return agent
    return None


# ═══════════════════════════════════════════════════════════════
# AI CLASSIFICATION (Claude Haiku — last resort for ambiguous)
# ═══════════════════════════════════════════════════════════════

CLASSIFY_PROMPT = """You classify emails for D4 Insight's automation system.
Return EXACTLY ONE word — the category.

Categories:

"leave" — A FORMAL leave request where the sender is explicitly requesting or
  informing about their own absence on specific dates.
  MUST have: clear intent ("I will be on leave", "applying for leave", "requesting leave")
  AND specific dates or at least "today"/"tomorrow".
  NOT leave: casual mentions ("might take leave"), discussing policy, past leave info,
  forwarding someone else's leave, asking questions about leave balance.

"hiring" — Hiring requirements, job descriptions, candidate profiles/resumes,
  interview scheduling, selection/rejection updates, onboarding emails.

"timesheet" — Timesheet submission, review, approval, hours verification,
  consolidation feedback, period reminders.

"sow" — Statement of Work approval, review, feedback, or changes.

"ignore" — Everything else: newsletters, general discussion, FYI, meeting invites,
  automated notifications, out-of-scope emails.

Return ONLY the single category word."""


def _classify_by_ai(subject, body_text, from_name):
    """Use Claude Haiku to classify an ambiguous email. Returns agent category."""
    try:
        from hiring_automation import get_claude
        claude = get_claude()
        if not claude:
            return "ignore"

        response = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            system=CLASSIFY_PROMPT,
            messages=[{"role": "user", "content":
                       f"From: {from_name}\nSubject: {subject}\n\nBody:\n{body_text[:1500]}"}],
        )
        result = response.content[0].text.strip().lower().split()[0]
        if result in ("leave", "hiring", "timesheet", "sow", "ignore"):
            return result
        return "ignore"
    except Exception as e:
        print(f"    AI classify error: {e}")
        return "ignore"


# ═══════════════════════════════════════════════════════════════
# MAIN CLASSIFIER
# ═══════════════════════════════════════════════════════════════

def classify_email(email, sender_email):
    """
    Classify an email into an agent category.

    Priority:
      1. Skip own sent emails
      2. Thread match (conversationId → known agent)
      3. Subject pattern (deterministic regex)
      4. AI classification (ambiguous fallback)
    """
    from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
    subject = email.get("subject", "")
    conversation_id = email.get("conversationId", "")

    # 1. Skip our own emails
    if from_addr.lower() == sender_email.lower():
        return "ignore"

    # 2. Thread match — replies always go to the owning agent
    if conversation_id:
        owner = get_thread_owner(conversation_id)
        if owner and owner != "ignore":
            return owner

    # 3. Subject pattern match
    subject_match = _classify_by_subject(subject)
    if subject_match:
        # Also register the thread so future replies route correctly
        if conversation_id and subject_match != "ignore":
            register_thread(conversation_id, subject_match, f"subject_match:{subject[:50]}")
        return subject_match

    # 4. AI classification
    body_content = email.get("body", {}).get("content", "")
    body_text = re.sub(r'<[^>]+>', ' ', body_content)
    body_text = re.sub(r'\s+', ' ', body_text).strip()[:2000]
    from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")

    agent = _classify_by_ai(subject, body_text, from_name)

    # Register thread for AI-classified emails too
    if conversation_id and agent != "ignore":
        register_thread(conversation_id, agent, f"ai_classified:{subject[:50]}")

    return agent


# ═══════════════════════════════════════════════════════════════
# EMAIL FETCHER
# ═══════════════════════════════════════════════════════════════

def fetch_new_emails(automation_module, days_back=14, limit=100):
    """Fetch all unprocessed emails from sysadmin inbox."""
    since = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00Z")
    url = (
        f"/users/{automation_module.SENDER_EMAIL}/messages?"
        f"$filter=receivedDateTime ge {since}"
        f"&$top={limit}"
        f"&$select=id,subject,body,from,receivedDateTime,conversationId,ccRecipients,hasAttachments"
        f"&$orderby=receivedDateTime desc"
    )

    try:
        result = automation_module.graph_get(url)
    except Exception as e:
        print(f"    Mailbox fetch error: {e}")
        return []

    emails = result.get("value", [])
    return [e for e in emails if not is_processed(e.get("id", ""))]


# ═══════════════════════════════════════════════════════════════
# ROUTE CYCLE — main entry point called each watch cycle
# ═══════════════════════════════════════════════════════════════

def route_cycle(automation_module):
    """
    Fetch all new emails, classify each into exactly one agent,
    and return them grouped.

    Returns: {"leave": [...], "hiring": [...], "timesheet": [...], "sow": [...], "ignore": [...]}
    """
    emails = fetch_new_emails(automation_module)

    routed = {"leave": [], "hiring": [], "timesheet": [], "sow": [], "ignore": []}

    for email in emails:
        email_id = email.get("id", "")
        subject = email.get("subject", "")[:60]
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")

        agent = classify_email(email, automation_module.SENDER_EMAIL)

        routed[agent].append(email)
        mark_processed(email_id, agent)

        if agent != "ignore":
            print(f"    [{agent.upper():10s}] {from_name}: {subject}")

    # Summary
    active = {k: len(v) for k, v in routed.items() if v and k != "ignore"}
    ignored = len(routed["ignore"])
    if active:
        parts = [f"{k}:{v}" for k, v in active.items()]
        if ignored:
            parts.append(f"ignored:{ignored}")
        print(f"    Routed: {' | '.join(parts)}")
    elif emails:
        print(f"    {len(emails)} email(s) scanned, all ignored/already-processed")
    else:
        print(f"    No new emails")

    return routed
