"""
D4 Insight VCC Automation Bot v2
=================================
Centralized email processing with proper agent isolation.

Replaces the old hire-watch loop where each agent independently
scanned the entire mailbox, causing:
  - SOW replies appearing in leave scanner
  - Casual leave mentions auto-recorded as leave
  - Timesheet reply threads mixed with hiring emails

Architecture:
  1. email_router fetches ALL new emails ONCE per cycle
  2. Each email is classified into exactly ONE agent
  3. Agents only process their own emails
  4. Thread tracking ensures replies stay in their lane

Usage:
  python watch_v2.py [interval_minutes]
  Default: 5 minutes

SystemD:
  ExecStart=/usr/bin/python3 /opt/d4-hiring/watch_v2.py 5
"""

import sys
import os
import time
import json
import traceback
from datetime import datetime, timedelta

# Ensure script directory is in path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import email_router
import leave_agent
import sow_agent


def _init_router():
    """One-time initialization: migrate old processed IDs to router."""
    marker = os.path.join(email_router.DATA_DIR, ".migrated")
    if os.path.exists(marker):
        return

    # Migrate from hiring_tracker.json
    hiring_path = os.path.join(SCRIPT_DIR, "..", "output", "hiring", "hiring_tracker.json")
    count = email_router.seed_processed_from_hiring(hiring_path)
    if count:
        print(f"  Migrated {count} processed email IDs from hiring tracker")

    # Migrate from old leave_records.json
    old_leave_path = os.path.join(SCRIPT_DIR, "..", "output", "leaves", "leave_records.json")
    if os.path.exists(old_leave_path):
        try:
            with open(old_leave_path) as f:
                old_data = json.load(f)
            processed = email_router._load_processed()
            migrated = 0
            for record in old_data.get("records", []):
                eid = record.get("email_id", "")
                if eid and eid not in processed["ids"]:
                    processed["ids"][eid] = {
                        "agent": "leave",
                        "processed_at": datetime.now().isoformat(),
                        "migrated": True,
                    }
                    migrated += 1
            email_router._save_processed(processed)
            if migrated:
                print(f"  Migrated {migrated} processed email IDs from leave tracker")
        except Exception:
            pass

    # Write marker
    os.makedirs(email_router.DATA_DIR, exist_ok=True)
    with open(marker, "w") as f:
        f.write(datetime.now().isoformat())


def run(interval_minutes=5):
    # Import automation modules
    import timesheet_automation as ts_mod
    import hiring_automation as hiring_mod

    print(f"\n  +{'='*58}+")
    print(f"  |{'D4 INSIGHT - VCC AUTOMATION BOT v2':^58s}|")
    print(f"  |{'Centralized Email Router':^58s}|")
    print(f"  +{'='*58}+")
    print(f"  Monitoring : {ts_mod.SENDER_EMAIL}")
    print(f"  Cycle      : every {interval_minutes} minutes")
    print(f"  Agents     : Leave | Hiring | SOW | Timesheet")
    if ts_mod.TEST_MODE:
        print(f"  MODE       : *** TEST — emails go to {ts_mod.TEST_EMAIL} ***")
    else:
        print(f"  MODE       : PRODUCTION")
    print(f"  Press Ctrl+C to stop.\n")

    _init_router()

    cycle = 0
    while True:
        cycle += 1
        now = datetime.now().strftime("%H:%M:%S")
        print(f"\n  {'─'*4} Cycle {cycle} [{now}] {'─'*40}")

        try:
            _run_cycle(ts_mod, hiring_mod)
        except KeyboardInterrupt:
            print("\n\n  Bot stopped.")
            break
        except Exception as e:
            print(f"  ERROR in cycle: {e}")
            traceback.print_exc()

        try:
            print(f"  Next scan in {interval_minutes} minutes...")
            time.sleep(interval_minutes * 60)
        except KeyboardInterrupt:
            print("\n\n  Bot stopped.")
            break


def _run_cycle(ts_mod, hiring_mod):
    """Single watch cycle."""

    # ── Step 1: Route all new emails ─────────────────────────
    print("  [1/6] Routing emails...")
    routed = email_router.route_cycle(ts_mod)

    # ── Step 2: Leave Agent ──────────────────────────────────
    leave_emails = routed.get("leave", [])
    if leave_emails:
        print(f"  [2/6] Leave agent ({len(leave_emails)} emails)...")
        results = leave_agent.process_leave_emails(leave_emails, ts_mod)
        if results:
            print(f"    {len(results)} leave(s) recorded")
            # Check for excessive leaves
            try:
                ts_mod.check_excessive_leaves_and_notify()
            except Exception as e:
                print(f"    Excessive leave check error: {e}")
    else:
        print("  [2/6] Leave agent — nothing")

    # ── Step 3: Hiring Agent ─────────────────────────────────
    hiring_emails = routed.get("hiring", [])
    print(f"  [3/6] Hiring agent ({len(hiring_emails)} emails)...")

    if hiring_emails:
        # Process requirements from pre-classified emails
        new_reqs = _process_hiring_requirements(hiring_emails, ts_mod, hiring_mod)
        for req in new_reqs:
            print(f"    >>> New requirement: {req['title']}")
            try:
                hiring_mod._send_ack_email(req, ts_mod, email_id=req.get("email_id"))
                hiring_mod._auto_generate_jd(req, ts_mod)
            except Exception as e:
                print(f"    Pipeline error: {e}")

        # Process profiles from pre-classified emails
        new_profiles = _process_hiring_profiles(hiring_emails, ts_mod, hiring_mod)
        for p in new_profiles:
            print(f"    >>> New profile: {p['candidate_name']}")

        # Process status updates from pre-classified emails
        _process_hiring_status_updates(hiring_emails, ts_mod, hiring_mod)

    # Non-email hiring tasks (operate on stored data, not inbox)
    try:
        hiring_mod._check_for_clarification_replies(ts_mod)
    except Exception as e:
        print(f"    Clarification check error: {e}")

    try:
        hiring_mod.check_bench_resources(ts_mod)
    except Exception as e:
        print(f"    Bench check error: {e}")

    # ── Step 4: SOW Agent ────────────────────────────────────
    sow_emails = routed.get("sow", [])
    if sow_emails:
        print(f"  [4/6] SOW agent ({len(sow_emails)} emails)...")
        sow_agent.process_sow_emails(sow_emails, ts_mod)
    else:
        print("  [4/6] SOW agent — nothing")

    # ── Step 4b: Drain email queue (SOW approval emails from webapp) ──
    _drain_email_queue(ts_mod)

    # ── Step 5: Timesheet Schedule ───────────────────────────
    print("  [5/6] Timesheet schedule...")
    _handle_timesheet(ts_mod, hiring_mod, routed.get("timesheet", []))

    # ── Step 6: Status ───────────────────────────────────────
    try:
        data = hiring_mod._load_hiring_data()
        open_reqs = len([r for r in data.get("requirements", []) if r["status"] == "open"])
        pending = len([r for r in data.get("requirements", [])
                       if r["status"] == "pending_clarification"])
        profiles = len(data.get("profiles", []))
        leaves = len(leave_agent.get_leave_records())
        print(f"\n  Status: {open_reqs} open reqs | {pending} pending | "
              f"{profiles} profiles | {leaves} leave records")
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════
# EMAIL QUEUE — sends emails queued by the webapp (SOW approvals etc.)
# ═══════════════════════════════════════════════════════════════

def _drain_email_queue(ts_mod):
    """Check Supabase email_queue for pending emails and send them via Graph API."""
    try:
        sb = ts_mod.get_supabase()
        if not sb:
            return

        result = sb.table("email_queue").select("*").eq("status", "pending").limit(10).execute()
        pending = result.data or []
        if not pending:
            return

        print(f"    Email queue: {len(pending)} pending email(s)")

        for job in pending:
            try:
                to_email = job.get("to_email", "")
                subject = job.get("subject", "")
                body_text = job.get("body_text", "")
                body_html = job.get("body_html", "")

                if not to_email or not subject:
                    sb.table("email_queue").update({
                        "status": "failed", "error": "Missing to_email or subject"
                    }).eq("id", job["id"]).execute()
                    continue

                # SAFETY: Only send to internal d4insight.com emails
                if not to_email.strip().lower().endswith("@d4insight.com"):
                    sb.table("email_queue").update({
                        "status": "failed",
                        "error": f"BLOCKED: External email '{to_email}' not allowed. Only @d4insight.com permitted."
                    }).eq("id", job["id"]).execute()
                    print(f"      BLOCKED: {to_email} (external emails not allowed)")
                    continue

                # Build HTML body
                html = body_html or f"<pre>{body_text}</pre>"
                if body_text and body_html:
                    # Wrap: body text as message + HTML attachment as SOW doc
                    html = f"<div style='font-family:Calibri,sans-serif;font-size:14px'>"
                    html += body_text.replace("\n", "<br>")
                    html += f"<hr style='margin:20px 0;border:none;border-top:1px solid #e2e8f0'>"
                    html += body_html
                    html += "</div>"

                # Send via Graph API
                ts_mod.send_email(
                    from_email=ts_mod.SENDER_EMAIL,
                    to_emails=[to_email],
                    cc_emails=[],
                    subject=subject,
                    html_body=html,
                )

                sb.table("email_queue").update({
                    "status": "sent", "sent_at": datetime.now().isoformat()
                }).eq("id", job["id"]).execute()

                print(f"      Sent: {subject[:50]} -> {to_email}")

                # Register thread for SOW emails so replies route to sow_agent
                if "SOW" in subject:
                    email_router.register_thread(
                        f"sow_email_{job['id']}", "sow",
                        f"sow_approval:{subject[:40]}"
                    )

            except Exception as e:
                print(f"      Email send failed: {e}")
                try:
                    sb.table("email_queue").update({
                        "status": "failed", "error": str(e)[:200]
                    }).eq("id", job["id"]).execute()
                except Exception:
                    pass

    except Exception as e:
        # email_queue table may not exist — silently skip
        err_str = str(e).lower()
        if "does not exist" not in err_str and "relation" not in err_str:
            print(f"    Email queue error: {e}")


# ═══════════════════════════════════════════════════════════════
# HIRING HELPERS — process pre-routed emails
# ═══════════════════════════════════════════════════════════════

def _process_hiring_requirements(emails, ts_mod, hiring_mod):
    """Process requirement emails (pre-classified by router)."""
    data = hiring_mod._load_hiring_data()
    processed_ids = set(data.get("processed_email_ids", []))
    claude = hiring_mod.get_claude()
    new_requirements = []

    for email in emails:
        email_id = email.get("id", "")
        if email_id in processed_ids:
            continue

        subject = email.get("subject", "")
        body_content = email.get("body", {}).get("content", "")
        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")

        if from_addr.lower() == ts_mod.SENDER_EMAIL.lower():
            processed_ids.add(email_id)
            continue

        # Quick keyword check
        combined = (subject + " " + body_content).lower()
        if not any(kw in combined for kw in hiring_mod.REQUIREMENT_KEYWORDS):
            continue

        try:
            clean_body = re.sub(r'<[^>]+>', ' ', body_content)
            clean_body = re.sub(r'\s+', ' ', clean_body).strip()[:3000]

            response = claude.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=800,
                system=hiring_mod.PARSE_REQUIREMENT_PROMPT,
                messages=[{"role": "user", "content":
                           f"Subject: {subject}\nFrom: {from_name} <{from_addr}>\n\n"
                           f"{clean_body}\n\nIMPORTANT: Return ONLY a raw JSON object."}]
            )

            raw_text = response.content[0].text.strip()
            import re as _re
            json_match = _re.search(r'\{[\s\S]*\}', raw_text)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(raw_text)

            if parsed.get("is_requirement") == False:
                processed_ids.add(email_id)
                continue

            if parsed.get("is_vague") and parsed.get("clarification_questions"):
                hiring_mod._send_clarification_email(parsed, subject, ts_mod, email_id=email_id)
                req = _build_requirement(parsed, email, from_name, from_addr, data,
                                         status="pending_clarification")
                req["missing_fields"] = parsed.get("missing_fields", [])
                data["requirements"].append(req)
                hiring_mod._sync_requirement_to_supabase(req, ts_mod)
            else:
                req = _build_requirement(parsed, email, from_name, from_addr, data,
                                         status="open")
                data["requirements"].append(req)
                new_requirements.append(req)
                hiring_mod._sync_requirement_to_supabase(req, ts_mod)

            # Register thread
            conv_id = email.get("conversationId", "")
            if conv_id:
                email_router.register_thread(conv_id, "hiring",
                                             f"req:{parsed.get('title', '')[:40]}")

        except Exception as e:
            print(f"    Requirement parse error: {e}")

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    hiring_mod._save_hiring_data(data)
    return new_requirements


def _build_requirement(parsed, email, from_name, from_addr, data, status="open"):
    """Build a requirement dict from parsed data."""
    return {
        "id": f"REQ-{datetime.now().strftime('%Y%m%d%H%M%S')}-{len(data['requirements'])+1}",
        "email_id": email.get("id", ""),
        "title": parsed.get("title", email.get("subject", "")),
        "description": parsed.get("description", ""),
        "project": parsed.get("project", ""),
        "skills": parsed.get("skills", ""),
        "location_type": parsed.get("location_type", "offshore"),
        "location_detail": parsed.get("location_detail", ""),
        "positions_count": parsed.get("positions_count", 1),
        "priority": parsed.get("priority", "medium"),
        "sender_name": parsed.get("sender_name", from_name),
        "sender_email": parsed.get("sender_email", from_addr),
        "status": status,
        "profiles": [],
        "jd_generated": False,
        "created_at": datetime.now().isoformat(),
        "received_date": email.get("receivedDateTime", ""),
    }


def _process_hiring_profiles(emails, ts_mod, hiring_mod):
    """Process profile/resume emails (pre-classified by router)."""
    data = hiring_mod._load_hiring_data()
    processed_ids = set(data.get("processed_email_ids", []))
    claude = hiring_mod.get_claude()
    new_profiles = []

    profile_keywords = ["resume", "profile", "candidate", "cv attached", "shortlisted",
                        "applying for", "experience in"]

    for email in emails:
        email_id = email.get("id", "")
        if email_id in processed_ids:
            continue

        subject = email.get("subject", "")
        body_content = email.get("body", {}).get("content", "")
        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")

        if from_addr.lower() == ts_mod.SENDER_EMAIL.lower():
            processed_ids.add(email_id)
            continue

        combined = (subject + " " + body_content).lower()
        if not any(kw in combined for kw in profile_keywords):
            continue

        try:
            clean_body = re.sub(r'<[^>]+>', ' ', body_content)
            clean_body = re.sub(r'\s+', ' ', clean_body).strip()[:2000]

            response = claude.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                system=hiring_mod.PARSE_PROFILE_PROMPT,
                messages=[{"role": "user", "content":
                           f"Subject: {subject}\nFrom: {from_name} <{from_addr}>\n"
                           f"Has Attachments: {email.get('hasAttachments', False)}\n\n{clean_body}"}]
            )

            parsed = json.loads(response.content[0].text)
            if parsed.get("is_profile", True) != False:
                profile = {
                    "id": f"PROF-{datetime.now().strftime('%Y%m%d%H%M%S')}-{len(data['profiles'])+1}",
                    "email_id": email_id,
                    "candidate_name": parsed.get("candidate_name", "Unknown"),
                    "position": parsed.get("position", ""),
                    "skills": parsed.get("skills", ""),
                    "experience_years": parsed.get("experience_years", ""),
                    "sender_name": parsed.get("sender_name", from_name),
                    "sender_email": parsed.get("sender_email", from_addr),
                    "has_attachment": email.get("hasAttachments", False),
                    "status": "received",
                    "received_date": email.get("receivedDateTime", ""),
                    "created_at": datetime.now().isoformat(),
                }
                matched = hiring_mod._match_profile_to_requirement(profile, data["requirements"])
                if matched:
                    profile["requirement_id"] = matched["id"]
                    matched.setdefault("profiles", []).append(profile["id"])
                data["profiles"].append(profile)
                new_profiles.append(profile)
        except Exception as e:
            print(f"    Profile parse error: {e}")

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    hiring_mod._save_hiring_data(data)
    return new_profiles


def _process_hiring_status_updates(emails, ts_mod, hiring_mod):
    """Process candidate status update emails (pre-classified by router)."""
    data = hiring_mod._load_hiring_data()
    processed_ids = set(data.get("processed_email_ids", []))
    claude = hiring_mod.get_claude()

    status_keywords = ["selected", "shortlisted", "interview scheduled", "rejected",
                       "offer accepted", "offer sent", "joined", "onboarding",
                       "not suitable", "moved forward", "final round", "cleared interview"]

    STATUS_PARSE_PROMPT = """You parse emails about candidate hiring status updates at D4 Insight.
Extract:
- candidate_name: Name of the candidate being discussed
- new_status: One of: shortlisted, interview_scheduled, interviewed, selected, rejected, offer_sent, offer_accepted, onboarding, joined
- notes: Brief context
If NOT about a candidate status update, return: {"is_update": false}
Return ONLY valid JSON."""

    for email in emails:
        email_id = email.get("id", "")
        if email_id in processed_ids:
            continue

        subject = email.get("subject", "")
        body_content = email.get("body", {}).get("content", "")
        combined = (subject + " " + body_content).lower()

        if not any(kw in combined for kw in status_keywords):
            continue

        try:
            clean_body = re.sub(r'<[^>]+>', ' ', body_content)
            clean_body = re.sub(r'\s+', ' ', clean_body).strip()[:2000]

            response = claude.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=STATUS_PARSE_PROMPT,
                messages=[{"role": "user", "content": f"Subject: {subject}\n\n{clean_body}"}]
            )

            parsed = json.loads(response.content[0].text)
            if parsed.get("is_update") != False and parsed.get("candidate_name"):
                name = parsed["candidate_name"]
                new_status = parsed.get("new_status", "")
                if new_status:
                    updated = hiring_mod.update_profile_status(name, new_status, data)
                    if updated:
                        print(f"    Status: {name} → {new_status}")
                        if new_status == "offer_accepted":
                            hiring_mod.send_onboarding_email(name, ts_mod)
        except Exception:
            pass

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    hiring_mod._save_hiring_data(data)


# ═══════════════════════════════════════════════════════════════
# TIMESHEET HANDLER
# ═══════════════════════════════════════════════════════════════

def _handle_timesheet(ts_mod, hiring_mod, timesheet_emails):
    """Handle timesheet schedule actions."""
    ts_action = hiring_mod._get_timesheet_schedule_action()
    today = datetime.now()

    ts_state_file = os.path.join(
        os.path.dirname(os.path.abspath(hiring_mod.__file__)),
        "..", "output", "hiring", "ts_last_run.json")
    ts_ran_today = False
    try:
        with open(ts_state_file) as f:
            ts_state = json.load(f)
        ts_ran_today = (ts_state.get("date") == today.strftime("%Y-%m-%d") and
                        ts_state.get("action") == ts_action)
    except Exception:
        pass

    if ts_action != "monitor" and not ts_ran_today:
        print(f"    Timesheet: {ts_action} (day {today.day})...")
        hiring_mod._run_timesheet_step(ts_action, ts_mod)
        try:
            os.makedirs(os.path.dirname(ts_state_file), exist_ok=True)
            with open(ts_state_file, "w") as f:
                json.dump({"date": today.strftime("%Y-%m-%d"), "action": ts_action}, f)
        except Exception:
            pass
    elif ts_action == "monitor":
        print("    Timesheet: monitoring for review reply...")
        hiring_mod._run_timesheet_step("monitor", ts_mod)
    else:
        print(f"    Timesheet: {ts_action} already ran today")


# ═══════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import re
    interval = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    run(interval)
