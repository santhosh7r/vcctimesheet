"""
AI-Powered Timesheet Review Agent
===================================
Uses Claude API to:
1. Parse reviewer email replies → extract structured action items
2. Auto-ping resources on Teams for verification
3. Monitor Teams replies → determine yes/no
4. Auto-apply resolved edits and resend

Usage (called from timesheet_automation.py):
  python timesheet_automation.py ai-review "13AprTo-26Apr_2026"
"""

import os
import json
import time
import re
from anthropic import Anthropic

# ═══════════════════════════════════════════════════════════════
# CLAUDE CLIENT
# ═══════════════════════════════════════════════════════════════

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

def get_claude():
    if not ANTHROPIC_API_KEY:
        raise ValueError(
            "ANTHROPIC_API_KEY not set. Export it:\n"
            "  export ANTHROPIC_API_KEY=sk-ant-..."
        )
    return Anthropic(api_key=ANTHROPIC_API_KEY)


# ═══════════════════════════════════════════════════════════════
# STEP 1: PARSE REVIEWER'S EMAIL → ACTION ITEMS
# ═══════════════════════════════════════════════════════════════

PARSE_SYSTEM_PROMPT = """You are a timesheet review assistant for D4 Insight (an IT staffing company).
You parse email feedback from a reviewer (Anand) about fortnightly timesheets.

The timesheets have this structure:
- Multiple project groups (IT_ALL, D365_FO, QA_QC, Salesforce, JDE_EDI, Enterprise_Integration, IT_Support_Savannah, PartnerInsight, Web_B2B)
- Each has resources with hours worked in a 2-week period
- Standard hours = 80 (10 working days × 8 hours)

Extract EVERY actionable item from the reviewer's feedback. Categorize each as:

1. "edit" — Direct change needed (e.g., "Aravindh should be 80 not 84")
2. "ask" — Need to verify with the resource (e.g., "check if Mohammed worked on election day")
3. "confirm" — Need to verify billing/allocation status (e.g., "hope Ashwath billing is confirmed")
4. "info" — Just a note, no action needed (e.g., "helpdesk members have pre-approval to work holidays")

Return ONLY valid JSON array. Each item:
{
  "type": "edit" | "ask" | "confirm" | "info",
  "resource": "person name",
  "group": "project group name or best guess",
  "current_hours": number or null,
  "new_hours": number or null (for edits),
  "question": "what to ask the resource" (for ask/confirm),
  "reason": "brief explanation",
  "original_text": "the exact feedback text this came from"
}

Be thorough — extract every single item, even subtle ones."""


def parse_reviewer_feedback(email_body, timesheet_context):
    """
    Use Claude to parse Anand's email reply into structured action items.

    email_body: the text of Anand's reply
    timesheet_context: summary of current timesheet data for reference
    """
    client = get_claude()

    user_msg = f"""Here is the timesheet context for this period:

{timesheet_context}

Here is the reviewer's email feedback:

---
{email_body}
---

Extract all action items from this feedback. Return ONLY a JSON array."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=PARSE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    # Extract JSON from response
    text = response.content[0].text
    # Try to find JSON array in the response
    json_match = re.search(r'\[.*\]', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())

    # Try parsing the whole response as JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"  WARNING: Could not parse AI response as JSON")
        print(f"  Raw response: {text[:500]}")
        return []


# ═══════════════════════════════════════════════════════════════
# STEP 2: GENERATE TEAMS MESSAGES
# ═══════════════════════════════════════════════════════════════

TEAMS_MSG_PROMPT = """You are writing a brief, professional Teams message to a D4 Insight employee
about their timesheet. Keep it short (2-3 sentences max), friendly, and clear about what you need them to confirm.
The message is sent by Gayathri from the timesheet team.

Return ONLY the message text (plain text, no HTML)."""


def generate_teams_message(resource_name, question, period_label):
    """Use Claude to generate a natural Teams message for the resource."""
    client = get_claude()

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=TEAMS_MSG_PROMPT,
        messages=[{"role": "user", "content": (
            f"Resource: {resource_name}\n"
            f"Period: {period_label}\n"
            f"Question: {question}\n\n"
            f"Write the Teams message."
        )}],
    )
    return response.content[0].text.strip()


# ═══════════════════════════════════════════════════════════════
# STEP 3: PARSE TEAMS REPLIES
# ═══════════════════════════════════════════════════════════════

PARSE_REPLY_PROMPT = """You are analyzing a Teams chat reply from a D4 Insight employee
regarding their timesheet verification.

Determine:
1. Did they confirm they worked? ("yes" / "no" / "unclear")
2. If they mention specific hours or days
3. Any corrections they want to make

Return ONLY valid JSON:
{
  "worked": "yes" | "no" | "partial" | "unclear",
  "hours_correction": number or null,
  "days_off": ["list of dates they were off"] or [],
  "explanation": "brief summary",
  "action": "keep" | "remove_hours" | "adjust" | "needs_followup",
  "adjusted_hours": number or null
}"""


def parse_teams_reply(reply_text, original_question, resource_name):
    """Use Claude to parse a Teams reply and determine the action."""
    client = get_claude()

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=PARSE_REPLY_PROMPT,
        messages=[{"role": "user", "content": (
            f"Resource: {resource_name}\n"
            f"Original question: {original_question}\n"
            f"Their reply: {reply_text}\n\n"
            f"Analyze this reply."
        )}],
    )

    text = response.content[0].text
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"worked": "unclear", "action": "needs_followup", "explanation": text[:200]}


# ═══════════════════════════════════════════════════════════════
# MAIN AI REVIEW FLOW
# ═══════════════════════════════════════════════════════════════

def run_ai_review(period_label, timesheet_automation):
    """
    Full AI-powered review flow:
    1. Fetch reviewer's reply email
    2. Parse with AI → action items
    3. Auto-handle edits, send Teams messages for verifications
    4. Monitor replies
    5. Apply final edits and resend

    timesheet_automation: the imported timesheet_automation module (for its functions)
    """
    ta = timesheet_automation  # shorthand

    print("\n  [AI REVIEW] Fetching reviewer's feedback...\n")

    # Step 1: Get the reply email
    replies = ta.check_reply_edits(period_label)
    if not replies:
        print("  No reply found. Nothing to process.")
        return

    # Get the most recent reply body
    latest = replies[0]
    body_raw = latest.get("body", {}).get("content", "")
    # Strip HTML
    body_text = re.sub(r'<[^>]+>', '', body_raw).strip()
    body_text = re.sub(r'\s+', ' ', body_text)[:3000]

    frm = latest.get("from", {}).get("emailAddress", {}).get("address", "")
    dt = latest.get("receivedDateTime", "")[:16]
    print(f"  Reply from: {frm} at {dt}")
    print(f"  Content preview: {body_text[:300]}...")

    # Step 2: Build timesheet context
    period_dir = os.path.join(ta.OUTPUT_DIR, period_label)
    context_lines = ["Current timesheet data:"]
    for group_key, config in ta.TIMESHEET_CONFIG.items():
        context_lines.append(f"\n{group_key}:")
        for r in config["resources"]:
            context_lines.append(f"  - {r['name']} ({r['project']})")
    timesheet_context = "\n".join(context_lines)

    # Step 3: AI parse
    print("\n  [AI] Parsing feedback with Claude...\n")
    action_items = parse_reviewer_feedback(body_text, timesheet_context)

    if not action_items:
        print("  No action items extracted.")
        return

    # Display parsed items
    print(f"  Found {len(action_items)} action item(s):\n")
    edits_to_apply = []
    people_to_ask = []
    info_items = []

    for i, item in enumerate(action_items, 1):
        item_type = item.get("type", "info")
        resource = item.get("resource", "?")
        group = item.get("group", "?")
        reason = item.get("reason", "")
        original = item.get("original_text", "")

        if item_type == "edit":
            new_hrs = item.get("new_hours")
            print(f"  [{i}] EDIT: {resource} in {group} → {new_hrs}h")
            print(f"       Reason: {reason}")
            edits_to_apply.append(item)

        elif item_type in ("ask", "confirm"):
            question = item.get("question", f"Please confirm your timesheet for {period_label}")
            print(f"  [{i}] ASK: {resource}")
            print(f"       Question: {question}")
            people_to_ask.append(item)

        elif item_type == "info":
            print(f"  [{i}] INFO: {reason}")
            info_items.append(item)

    # Step 4: Confirm and execute
    print(f"\n  Summary: {len(edits_to_apply)} edits, {len(people_to_ask)} verifications, {len(info_items)} info notes")

    if edits_to_apply or people_to_ask:
        confirm = input("\n  Proceed with edits and Teams messages? [y/N]: ").strip().lower()
        if confirm != "y":
            print("  Cancelled.")
            return

    # Apply direct edits
    if edits_to_apply:
        edit_dicts = []
        for item in edits_to_apply:
            edit_dicts.append({
                "name": item["resource"],
                "group": item.get("group", ""),
                "hours": item.get("new_hours", 0),
            })
        ta.apply_edits(period_label, edit_dicts)

    # Send Teams messages for verifications
    pending_verifications = []
    if people_to_ask:
        print(f"\n  [AI] Sending {len(people_to_ask)} Teams verification messages...\n")
        for item in people_to_ask:
            resource = item["resource"]
            question = item.get("question", f"Please confirm your timesheet hours for {period_label}")

            # Generate natural Teams message
            msg = generate_teams_message(resource, question, period_label)
            print(f"  → {resource}: \"{msg[:80]}...\"")

            # Send via Teams
            html_msg = msg.replace("\n", "<br>")
            ta.ping_resource_on_teams(resource, html_msg, period_label)
            pending_verifications.append({
                "resource": resource,
                "group": item.get("group", ""),
                "question": question,
                "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
            time.sleep(0.5)

    # Save pending state
    state_file = os.path.join(period_dir, "_review_state.json")
    state = {
        "period": period_label,
        "reviewed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "edits_applied": [{"resource": e["resource"], "group": e.get("group"), "new_hours": e.get("new_hours")} for e in edits_to_apply],
        "pending_verifications": pending_verifications,
        "info_notes": [{"reason": i.get("reason", "")} for i in info_items],
    }
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)
    print(f"\n  Review state saved to {state_file}")

    # Resend if edits were applied
    if edits_to_apply:
        master_file = os.path.join(period_dir, f"Consolidated_VCC_ALL_{period_label}.xlsx")
        target = ta.TEST_EMAIL if ta.TEST_MODE else ta.ANAND_EMAIL

        # Build change summary
        change_lines = []
        for e in edits_to_apply:
            change_lines.append(f"<li><b>{e['resource']}</b> ({e.get('group','')}): → {e.get('new_hours')}h — {e.get('reason','')}</li>")
        changes_html = "<ul>" + "".join(change_lines) + "</ul>"

        pending_html = ""
        if pending_verifications:
            pending_names = ", ".join([p["resource"] for p in pending_verifications])
            pending_html = f"<p><b>Pending verification ({len(pending_verifications)}):</b> {pending_names} — Teams messages sent, awaiting their response.</p>"

        html = f"""
        <p>Hi,</p>
        <p>The following changes have been applied to the Consolidated Timesheet for <b>{period_label}</b>:</p>
        {changes_html}
        {pending_html}
        <p>Updated file attached. Kindly confirm.</p>
        <br>
        <p>Thank you and regards,<br>Gayathri</p>
        """
        ta.send_email(
            from_email=ta.SENDER_EMAIL,
            to_emails=[target],
            cc_emails=[],
            subject=f"[UPDATED] Consolidated Timesheet - VCC All Projects - {period_label}",
            html_body=html,
            attachments=[master_file],
        )
        print(f"\n  Updated file sent to {target}")

    if pending_verifications:
        print(f"\n  {len(pending_verifications)} verification(s) pending.")
        print(f"  Run 'ai-resolve' later to check Teams replies and finalize.")


# ═══════════════════════════════════════════════════════════════
# RESOLVE PENDING VERIFICATIONS
# ═══════════════════════════════════════════════════════════════

def resolve_pending(period_label, timesheet_automation):
    """
    Check Teams replies for pending verifications and resolve them.
    """
    ta = timesheet_automation
    period_dir = os.path.join(ta.OUTPUT_DIR, period_label)
    state_file = os.path.join(period_dir, "_review_state.json")

    if not os.path.exists(state_file):
        print("  No pending review state found. Run 'ai-review' first.")
        return

    with open(state_file) as f:
        state = json.load(f)

    pending = state.get("pending_verifications", [])
    if not pending:
        print("  No pending verifications.")
        return

    print(f"\n  {len(pending)} pending verification(s):\n")

    resolved_edits = []
    still_pending = []

    for p in pending:
        resource = p["resource"]
        question = p["question"]
        group = p["group"]

        print(f"  Checking reply from {resource}...")

        # Try to find their Teams reply
        # Search recent chats for messages from this person
        user = ta.find_user_by_name(resource)
        if not user or not user.get("mail"):
            print(f"    Could not find {resource} — still pending")
            still_pending.append(p)
            continue

        user_email = user["mail"]
        reply_text = None

        try:
            # Get recent chats
            chats = ta.graph_get(f"/users/{ta.SENDER_EMAIL}/chats?$top=20")
            for chat in chats.get("value", []):
                chat_id = chat["id"]
                # Get messages in this chat
                msgs = ta.graph_get(f"/chats/{chat_id}/messages?$top=5")
                for msg in msgs.get("value", []):
                    msg_from = msg.get("from", {}).get("user", {}).get("displayName", "")
                    if resource.lower() in msg_from.lower():
                        body = msg.get("body", {}).get("content", "")
                        if body and len(body) > 5:
                            reply_text = re.sub(r'<[^>]+>', '', body).strip()
                            break
                if reply_text:
                    break
        except Exception as e:
            print(f"    Error reading chats: {e}")

        if not reply_text:
            print(f"    No reply yet from {resource} — still pending")
            still_pending.append(p)
            continue

        print(f"    Reply: \"{reply_text[:100]}\"")

        # AI parse the reply
        result = parse_teams_reply(reply_text, question, resource)
        action = result.get("action", "needs_followup")
        explanation = result.get("explanation", "")

        print(f"    AI analysis: {action} — {explanation}")

        if action == "keep":
            print(f"    → Keeping {resource}'s hours as-is (confirmed they worked)")
        elif action == "remove_hours":
            days_off = result.get("days_off", [])
            adjusted = result.get("adjusted_hours")
            if adjusted is not None:
                resolved_edits.append({"name": resource, "group": group, "hours": adjusted})
                print(f"    → Adjusting {resource} to {adjusted}h")
            else:
                print(f"    → Flagged for manual review (days off: {days_off})")
                still_pending.append(p)
        elif action == "adjust":
            adjusted = result.get("adjusted_hours")
            if adjusted is not None:
                resolved_edits.append({"name": resource, "group": group, "hours": adjusted})
                print(f"    → Adjusting {resource} to {adjusted}h")
            else:
                still_pending.append(p)
        else:
            print(f"    → Needs manual followup")
            still_pending.append(p)

    # Apply resolved edits
    if resolved_edits:
        print(f"\n  Applying {len(resolved_edits)} resolved edit(s)...")
        ta.apply_edits(period_label, resolved_edits)

    # Update state
    state["pending_verifications"] = still_pending
    state["resolved"] = state.get("resolved", []) + [
        {"resource": e["name"], "hours": e["hours"]} for e in resolved_edits
    ]
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)

    if still_pending:
        print(f"\n  {len(still_pending)} still pending: {', '.join(p['resource'] for p in still_pending)}")
    else:
        print(f"\n  All verifications resolved!")

    # Resend if edits were made
    if resolved_edits:
        master_file = os.path.join(period_dir, f"Consolidated_VCC_ALL_{period_label}.xlsx")
        target = ta.TEST_EMAIL if ta.TEST_MODE else ta.ANAND_EMAIL

        confirm = input(f"\n  Resend final updated file to {target}? [y/N]: ").strip().lower()
        if confirm == "y":
            change_lines = "".join(
                f"<li><b>{e['name']}</b>: → {e['hours']}h</li>" for e in resolved_edits
            )
            still_html = ""
            if still_pending:
                still_html = f"<p><i>Still pending: {', '.join(p['resource'] for p in still_pending)}</i></p>"

            html = f"""
            <p>Hi,</p>
            <p>Verification responses received. Updated timesheet for <b>{period_label}</b>:</p>
            <ul>{change_lines}</ul>
            {still_html}
            <p>Please confirm if this is final.</p>
            <br>
            <p>Thank you and regards,<br>Gayathri</p>
            """
            ta.send_email(
                from_email=ta.SENDER_EMAIL,
                to_emails=[target],
                cc_emails=[],
                subject=f"[FINAL] Consolidated Timesheet - VCC All Projects - {period_label}",
                html_body=html,
                attachments=[master_file],
            )
            print(f"  Sent final version to {target}")
