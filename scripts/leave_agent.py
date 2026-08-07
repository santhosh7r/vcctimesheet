"""
D4 Insight Leave Agent
=======================
Processes ONLY emails pre-classified as leave requests by email_router.
Never scans the inbox directly.

Safety rules:
  1. NEVER auto-record leave from casual mentions
  2. Require explicit intent + specific dates
  3. Ambiguous cases get a confirmation email (not auto-recorded)
  4. Past dates are informational only — not actionable
  5. "I might take leave" / "planning leave" = NOT a leave request

This replaces the old scan_leave_emails() which scanned everything
and had false positives (e.g., auto-recording a casually mentioned future leave).
"""

import os
import re
import json
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "router_data")
LEAVE_DATA_FILE = os.path.join(DATA_DIR, "leave_records.json")


# ═══════════════════════════════════════════════════════════════
# AI PROMPT — strict leave parsing
# ═══════════════════════════════════════════════════════════════

PARSE_LEAVE_PROMPT = """You parse emails to extract leave request details for D4 Insight.

STRICT RULES — follow these exactly:
1. VALID leave: Person is explicitly requesting/informing about THEIR OWN absence.
   Examples: "I will be on leave on May 28", "Applying for leave from June 2-4",
   "I am taking sick leave today", "On leave tomorrow".
2. INVALID — casual mention: "I might take leave", "planning to take leave around June",
   "can I take leave?", "thinking of taking a break".
3. INVALID — past tense info: "I was on leave last week", "took leave yesterday".
4. INVALID — discussing others: "John is on leave", forwarding someone else's leave email.
5. INVALID — leave policy/balance discussions.
6. WFH (work from home) is NOT leave unless explicitly stated as leave.

Return ONLY valid JSON:
{
  "is_valid_leave_request": true/false,
  "confidence": "high"/"medium"/"low",
  "employee_name": "full name of person taking leave (from email signature or From field)",
  "dates": ["2026-05-28", "2026-05-29"],
  "leave_type": "casual/sick/planned",
  "reason": "brief reason if mentioned",
  "needs_confirmation": true/false,
  "needs_dates": false
}

Confidence guide:
- "high": Clear statement with specific dates ("I will be on leave on 28th May")
- "medium": Intent is clear but dates might be approximate ("on leave next Monday")
- "low": Ambiguous — could be a request or just a mention

Set needs_confirmation=true if confidence is "medium" or "low".

IMPORTANT — vague date handling:
- If intent is CLEARLY leave but specific dates are missing (e.g. "leave for a month",
  "taking leave next week", "will be on leave"), set:
  is_valid_leave_request=true, needs_dates=true, dates=[], confidence="medium"
- This allows the system to reply asking for specific dates.
- Only set is_valid_leave_request=false if this is NOT a leave request at all."""


# ═══════════════════════════════════════════════════════════════
# DATA PERSISTENCE
# ═══════════════════════════════════════════════════════════════

def _load_leave_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        if os.path.exists(LEAVE_DATA_FILE):
            with open(LEAVE_DATA_FILE) as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {"records": [], "pending_confirmations": []}


def _save_leave_data(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(LEAVE_DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


# ═══════════════════════════════════════════════════════════════
# RESOURCE MATCHING
# ═══════════════════════════════════════════════════════════════

def _match_resource(name_or_email, automation_module):
    """Match a name or email to a known resource in TIMESHEET_CONFIG.
    Returns (resource_name, group_key) or (None, None)."""
    if not name_or_email:
        return None, None

    target = name_or_email.lower().strip()
    target_nospace = target.replace(" ", "")

    for group_key, config in automation_module.TIMESHEET_CONFIG.items():
        for r in config["resources"]:
            res_lower = r["name"].lower()
            res_nospace = res_lower.replace(" ", "")
            # Match: "senthilnathan" in "senthilnathan.r@d4insight.com"
            # Match: "Boyanarasimha" matches "boyanarasimha" partial
            if (res_nospace in target_nospace or
                target_nospace in res_nospace or
                (len(res_nospace) >= 5 and target_nospace.startswith(res_nospace[:5])) or
                (len(target_nospace) >= 5 and res_nospace.startswith(target_nospace[:5]))):
                return r["name"], group_key

    # Also try matching via Supabase user list
    try:
        sb = automation_module.get_supabase()
        if sb:
            result = sb.table("users").select("id,name").eq("is_active", True).execute()
            for u in (result.data or []):
                uname = u["name"].lower().replace(" ", "")
                if (uname in target_nospace or target_nospace in uname or
                    (len(uname) >= 5 and target_nospace.startswith(uname[:5]))):
                    return u["name"], ""
    except Exception:
        pass

    return None, None


# ═══════════════════════════════════════════════════════════════
# MAIN PROCESSING
# ═══════════════════════════════════════════════════════════════

def process_leave_emails(emails, automation_module):
    """
    Process emails that the router classified as leave requests.
    Uses AI with strict rules to validate before recording.

    Returns list of confirmed leave records.
    """
    if not emails:
        return []

    print(f"\n  Leave agent: checking {len(emails)} email(s)...")

    data = _load_leave_data()
    existing_ids = {r.get("email_id") for r in data["records"]}
    pending_ids = {p.get("email_id") for p in data.get("pending_confirmations", [])}

    confirmed_leaves = []

    try:
        from hiring_automation import get_claude
        claude = get_claude()
    except Exception:
        claude = None

    for email in emails:
        email_id = email.get("id", "")
        if email_id in existing_ids:
            continue

        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")
        subject = email.get("subject", "")
        conversation_id = email.get("conversationId", "")
        body_raw = email.get("body", {}).get("content", "")
        body_text = re.sub(r'<[^>]+>', ' ', body_raw)
        body_text = re.sub(r'\s+', ' ', body_text).strip()[:2000]

        # Check if this is a reply to a pending confirmation
        if email_id in pending_ids or _is_confirmation_reply(email, data):
            _handle_confirmation_reply(email, data, automation_module)
            continue

        # Use AI to parse with STRICT rules
        parsed = None
        if claude:
            try:
                response = claude.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=300,
                    system=PARSE_LEAVE_PROMPT,
                    messages=[{"role": "user", "content":
                               f"From: {from_name} <{from_addr}>\n"
                               f"Subject: {subject}\n\n{body_text}"}],
                )
                raw = response.content[0].text.strip()
                json_match = re.search(r'\{[\s\S]*\}', raw)
                if json_match:
                    parsed = json.loads(json_match.group())
            except Exception as e:
                print(f"    AI parse error: {e}")

        # Gate 1: Must be a valid leave request
        if not parsed or not parsed.get("is_valid_leave_request"):
            print(f"    SKIP (not valid leave): {from_name} — \"{subject[:50]}\"")
            continue

        # Gate 2: Must have specific dates (or ask for them)
        dates = parsed.get("dates", [])
        if not dates:
            if parsed.get("needs_dates"):
                # Clear leave intent but no dates — ask for specific dates
                print(f"    ASKING DATES: {from_name} — \"{subject[:50]}\"")
                _send_date_request(email, from_name, automation_module)
                if conversation_id:
                    from email_router import register_thread
                    register_thread(conversation_id, "leave", f"leave_dates:{from_name}")
                continue
            print(f"    SKIP (no dates found): {from_name} — \"{subject[:50]}\"")
            continue

        # Gate 3: Match to a known resource
        emp_name = parsed.get("employee_name", "") or from_name or from_addr
        resource_name, group = _match_resource(emp_name, automation_module)
        if not resource_name:
            # Try matching from email address
            resource_name, group = _match_resource(from_addr, automation_module)
        if not resource_name:
            print(f"    SKIP (unknown resource): {emp_name} — \"{subject[:50]}\"")
            continue

        # Gate 4: Filter out past dates (only actionable dates)
        today_str = datetime.now().strftime("%Y-%m-%d")
        valid_dates = []
        for d in dates:
            try:
                dt = datetime.strptime(d, "%Y-%m-%d")
                # Allow today and future, reject anything more than 2 days in the past
                if d >= (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"):
                    valid_dates.append(d)
            except ValueError:
                pass

        if not valid_dates:
            print(f"    SKIP (all dates in past): {resource_name} — {dates}")
            continue

        # Gate 5: Confidence check — low/medium needs confirmation
        if parsed.get("needs_confirmation") or parsed.get("confidence") in ("low", "medium"):
            print(f"    CONFIRM NEEDED: {resource_name} — {valid_dates} (confidence: {parsed.get('confidence')})")
            _send_confirmation_request(email, resource_name, valid_dates, automation_module)
            data.setdefault("pending_confirmations", []).append({
                "email_id": email_id,
                "conversation_id": conversation_id,
                "resource": resource_name,
                "group": group,
                "dates": valid_dates,
                "subject": subject,
                "from_email": from_addr,
                "requested_at": datetime.now().isoformat(),
            })
            _save_leave_data(data)
            continue

        # All gates passed — HIGH confidence, record the leave
        record = {
            "email_id": email_id,
            "conversation_id": conversation_id,
            "resource": resource_name,
            "group": group,
            "email": from_addr,
            "subject": subject,
            "leave_dates": valid_dates,
            "num_days": len(valid_dates),
            "leave_type": parsed.get("leave_type", "casual"),
            "reason": parsed.get("reason", ""),
            "status": "active",
            "recorded_at": datetime.now().isoformat(),
        }
        data["records"].append(record)
        confirmed_leaves.append(record)

        print(f"    RECORDED: {resource_name} — {len(valid_dates)} day(s): {', '.join(valid_dates)}")

        # Sync to Supabase
        try:
            automation_module.sync_leave_to_supabase(
                resource_name, valid_dates,
                leave_type=parsed.get("leave_type", "casual"),
                reason=subject,
            )
        except Exception as e:
            print(f"    Supabase sync error: {e}")

        # Reply in-thread to acknowledge
        _send_acknowledgment(email, resource_name, valid_dates, automation_module)

        # Register thread ownership
        if conversation_id:
            from email_router import register_thread
            register_thread(conversation_id, "leave", f"leave:{resource_name}")

    _save_leave_data(data)
    return confirmed_leaves


# ═══════════════════════════════════════════════════════════════
# CONFIRMATION FLOW
# ═══════════════════════════════════════════════════════════════

def _is_confirmation_reply(email, data):
    """Check if this email is a reply to one of our confirmation requests."""
    conv_id = email.get("conversationId", "")
    from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "").lower()

    for p in data.get("pending_confirmations", []):
        if (p.get("conversation_id") == conv_id and conv_id) or \
           p.get("from_email", "").lower() == from_addr:
            return True
    return False


def _handle_confirmation_reply(email, data, automation_module):
    """Process a reply to our leave confirmation request."""
    from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "").lower()
    conv_id = email.get("conversationId", "")
    body_raw = email.get("body", {}).get("content", "")
    body_text = re.sub(r'<[^>]+>', ' ', body_raw).strip().lower()[:500]

    pending = data.get("pending_confirmations", [])
    match = None
    for p in pending:
        if (p.get("conversation_id") == conv_id and conv_id) or \
           p.get("from_email", "").lower() == from_addr:
            match = p
            break

    if not match:
        return

    if re.search(r'\byes\b|\bconfirm(?:ed)?\b|\bapproved?\b|\bcorrect\b', body_text):
        # Confirmed — record the leave
        record = {
            "email_id": match["email_id"],
            "resource": match["resource"],
            "group": match["group"],
            "email": match["from_email"],
            "subject": match["subject"],
            "leave_dates": match["dates"],
            "num_days": len(match["dates"]),
            "status": "active",
            "recorded_at": datetime.now().isoformat(),
            "confirmed_via": "email_reply",
        }
        data["records"].append(record)
        pending.remove(match)
        print(f"    CONFIRMED via reply: {match['resource']} — {len(match['dates'])} day(s)")

        try:
            automation_module.sync_leave_to_supabase(
                match["resource"], match["dates"], reason=match["subject"])
        except Exception:
            pass

        _send_acknowledgment(email, match["resource"], match["dates"], automation_module)

    elif re.search(r'\bno\b|\bcancel\b|\bnot\s+leave\b|\bwrong\b|\bignore\b', body_text):
        pending.remove(match)
        print(f"    CANCELLED: {match['resource']} — not a leave request")

    data["pending_confirmations"] = pending
    _save_leave_data(data)


def _send_confirmation_request(email, resource_name, dates, automation_module):
    """Send a confirmation email before recording uncertain leave."""
    email_id = email.get("id", "")
    date_str = ", ".join(dates)
    first_name = resource_name.split()[0]

    html = (
        f"<p>Hi {first_name},</p>"
        f"<p>I noticed you may be requesting leave for: <b>{date_str}</b>.</p>"
        f"<p>Could you please confirm by replying:</p>"
        f"<ul>"
        f"<li><b>Yes</b> — to confirm this leave</li>"
        f"<li><b>No</b> — if this was not a leave request</li>"
        f"</ul>"
        f"<br><p>Regards,<br>Qoppy — D4 Insight Automation</p>"
    )

    try:
        automation_module.send_email(
            from_email=automation_module.SENDER_EMAIL,
            to_emails=[], cc_emails=[],
            subject="", html_body=html,
            reply_to_message_id=email_id,
        )
        print(f"    Sent confirmation request to {resource_name}")

        conv_id = email.get("conversationId", "")
        if conv_id:
            from email_router import register_thread
            register_thread(conv_id, "leave", f"leave_confirm:{resource_name}")
    except Exception as e:
        print(f"    Confirmation send error: {e}")


def _send_date_request(email, from_name, automation_module):
    """Reply asking for specific leave dates when intent is clear but dates are missing."""
    email_id = email.get("id", "")
    first_name = from_name.split()[0] if from_name else "Hi"

    html = (
        f"<p>Hi {first_name},</p>"
        f"<p>I see you're planning to take leave. Could you please share the "
        f"<b>specific dates</b> (start and end date) so I can record it?</p>"
        f"<p>For example: <i>\"June 1 to June 30\"</i></p>"
        f"<br><p>Regards,<br>Qoppy — D4 Insight Automation</p>"
    )

    try:
        automation_module.send_email(
            from_email=automation_module.SENDER_EMAIL,
            to_emails=[], cc_emails=[],
            subject="", html_body=html,
            reply_to_message_id=email_id,
        )
        print(f"    Sent date request to {from_name}")
    except Exception as e:
        print(f"    Date request send error: {e}")


def _send_acknowledgment(email, resource_name, dates, automation_module):
    """Reply in-thread acknowledging the recorded leave."""
    email_id = email.get("id", "")
    date_str = ", ".join(dates)
    days = len(dates)
    first_name = resource_name.split()[0]

    html = (
        f"<p>Hi {first_name},</p>"
        f"<p>Your leave has been noted and recorded for: <b>{date_str}</b> "
        f"({days} day{'s' if days > 1 else ''}).</p>"
        f"<p>This has been updated in the system.</p>"
        f"<br><p>Regards,<br>Qoppy — D4 Insight Automation</p>"
    )

    try:
        automation_module.send_email(
            from_email=automation_module.SENDER_EMAIL,
            to_emails=[], cc_emails=[],
            subject="", html_body=html,
            reply_to_message_id=email_id,
        )
    except Exception as e:
        print(f"    Acknowledgment send error: {e}")


# ═══════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════

def get_leave_records():
    """Get all leave records (for use by other modules)."""
    data = _load_leave_data()
    return data.get("records", [])


def get_leaves_for_period(period_label, automation_module):
    """Get leaves that overlap with a timesheet period."""
    start, end, _ = automation_module.parse_period_dates(period_label)
    if not start or not end:
        return []

    records = get_leave_records()
    period_leaves = []

    for record in records:
        if record.get("status") != "active":
            continue
        for date_str in record.get("leave_dates", []):
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d")
                if start <= d <= end:
                    period_leaves.append(record)
                    break
            except ValueError:
                pass

    return period_leaves
