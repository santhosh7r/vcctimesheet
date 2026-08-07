"""
D4 Insight SOW Agent
=====================
Processes SOW (Statement of Work) approval email responses.
Only handles emails pre-classified as "sow" by email_router.

Detects approval, rejection, or feedback in replies to
"SOW Approval Required:" emails and updates Supabase.
"""

import os
import re
import json
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "router_data")


PARSE_SOW_PROMPT = """You parse a REPLY to a SOW (Statement of Work) approval email.
The original subject was like "SOW Approval Required: [resource] - [SOW number]".

IMPORTANT: This is a REPLY email. The person is responding to a request for approval.
Focus on their NEW reply text, NOT the quoted/forwarded original SOW content below.
Common approval patterns: "Approved", "Looks good", "OK", "Go ahead", "LGTM", "Yes".
Common rejection patterns: "Rejected", "Not approved", "No", "Cannot approve".
If the reply is short (1-3 words like "Approved" or "Ok"), that IS an approval — don't mark as unclear.

Determine the response:
- "approved" — Person approved the SOW (even brief replies like "Approved", "Ok", "Looks good")
- "rejected" — Person rejected the SOW
- "feedback" — Person has questions or requested changes
- "unclear" — Truly cannot determine intent (empty reply, completely unrelated content)

Return ONLY valid JSON:
{
  "intent": "approved/rejected/feedback/unclear",
  "sow_number": "SOW number if visible (e.g. SOW-2026-170327)",
  "resource_name": "resource name if mentioned",
  "feedback_text": "brief summary of feedback if any",
  "approver_name": "name of person responding"
}"""


def process_sow_emails(emails, automation_module):
    """Process emails classified as SOW-related by the router."""
    if not emails:
        return []

    print(f"\n  SOW agent: processing {len(emails)} email(s)...")

    results = []

    try:
        from hiring_automation import get_claude
        claude = get_claude()
    except Exception:
        claude = None

    for email in emails:
        email_id = email.get("id", "")
        subject = email.get("subject", "")
        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")
        conversation_id = email.get("conversationId", "")
        body_raw = email.get("body", {}).get("content", "")
        body_text = re.sub(r'<[^>]+>', ' ', body_raw)
        body_text = re.sub(r'\s+', ' ', body_text).strip()

        # Extract ONLY the reply portion (before the quoted original message)
        # Outlook puts "From: Sender <email> Sent: date" at the start of quoted text
        reply_text = body_text
        from_marker = re.search(r'From:\s*(Sys\s*Admin|sysadmin@)', body_text, re.IGNORECASE)
        if from_marker:
            reply_text = body_text[:from_marker.start()].strip()
            # Remove the "INFO: INTERNAL EMAIL..." banner that Outlook adds
            reply_text = re.sub(r'INFO:\s*INTERNAL\s*EMAIL[^a-zA-Z]*Sent\s+from\s+your\s+own\s+D4\s+Insight\s+email\s+domain\s*', '', reply_text, flags=re.IGNORECASE).strip()

        # If we extracted a reply, use it; otherwise fall back to full text
        if reply_text:
            body_text = reply_text[:500]
        else:
            body_text = body_text[:2000]

        # Extract SOW number from subject
        sow_match = re.search(r'SOW[-_](\d{4}[-_]\d+)', subject)
        sow_number = sow_match.group(0) if sow_match else None

        # Use AI to parse the response intent
        parsed = None
        if claude:
            try:
                response = claude.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=200,
                    system=PARSE_SOW_PROMPT,
                    messages=[{"role": "user", "content":
                               f"From: {from_name} <{from_addr}>\n"
                               f"Subject: {subject}\n\n{body_text}"}],
                )
                raw = response.content[0].text.strip()
                json_m = re.search(r'\{[\s\S]*\}', raw)
                if json_m:
                    parsed = json.loads(json_m.group())
            except Exception as e:
                print(f"    AI parse error: {e}")

        if not parsed:
            print(f"    Could not parse SOW response: {from_name} — \"{subject[:50]}\"")
            continue

        intent = parsed.get("intent", "unclear")
        sow_num = parsed.get("sow_number") or sow_number
        feedback = parsed.get("feedback_text", "")

        print(f"    SOW {sow_num or '??'}: {intent.upper()} from {from_name}")
        if feedback:
            print(f"      Feedback: {feedback[:100]}")

        # Update Supabase
        if sow_num:
            _update_sow_in_supabase(sow_num, intent, from_name, feedback, automation_module)

        results.append({
            "sow_number": sow_num,
            "intent": intent,
            "from_name": from_name,
            "from_email": from_addr,
            "feedback": feedback,
            "email_id": email_id,
        })

        # Register thread for future replies
        if conversation_id:
            from email_router import register_thread
            register_thread(conversation_id, "sow", f"sow:{sow_num}")

    return results


def _update_sow_in_supabase(sow_number, intent, approver, feedback, automation_module):
    """Update SOW status in Supabase sows table."""
    try:
        sb = automation_module.get_supabase()
        if not sb:
            return

        status_map = {
            "approved": "finance_approved",
            "rejected": "rejected",
            "feedback": "changes_requested",
            "unclear": "submitted_for_finance",
        }

        new_status = status_map.get(intent, "submitted_for_finance")

        update_data = {
            "status": new_status,
            "updated_at": datetime.now().isoformat(),
        }

        if intent == "approved":
            update_data["finance_approved_at"] = datetime.now().isoformat()
            update_data["finance_notes"] = f"Approved by {approver}" + (f": {feedback}" if feedback else "")
        elif intent == "rejected":
            update_data["rejected_at"] = datetime.now().isoformat()
            update_data["rejection_reason"] = feedback or f"Rejected by {approver}"
            update_data["finance_notes"] = f"Rejected by {approver}" + (f": {feedback}" if feedback else "")
        elif feedback:
            update_data["finance_notes"] = f"[{approver}]: {feedback}"

        # SOW numbers might be stored as "SOW-2026-170327" or just "2026-170327"
        clean_num = sow_number.replace("SOW-", "").replace("SOW_", "")

        # Try exact match on sows table first, then partial
        result = sb.table("sows").update(update_data).eq(
            "sow_number", sow_number).execute()

        if not result.data:
            result = sb.table("sows").update(update_data).ilike(
                "sow_number", f"%{clean_num}%").execute()

        if result.data:
            print(f"    Supabase: SOW {sow_number} → {new_status}")
        else:
            print(f"    SOW {sow_number} not found in Supabase")

    except Exception as e:
        print(f"    Supabase SOW update error: {e}")
