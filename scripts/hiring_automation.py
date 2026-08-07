"""
Hiring & Open Position Automation
===================================
Automates the 10-step hiring pipeline:
1. Scan emails for new requirements
2. Create requirement in Supabase dashboard
3. AI-generate Job Description from requirement details
4. Track profiles received from recruitment
5. Detect interview selection/rejection emails
6. Track SOW approval flow
7. Trigger onboarding emails after offer acceptance
8. Bench tracking with auto-email for laptop handover

Usage (called from timesheet_automation.py):
  python timesheet_automation.py hire-scan          # Scan emails for new requirements
  python timesheet_automation.py hire-jd <req_id>   # AI-generate JD for a requirement
  python timesheet_automation.py hire-profiles      # Scan for profile submissions
  python timesheet_automation.py hire-status        # Show hiring pipeline status
  python timesheet_automation.py hire-onboard <name> # Trigger onboarding email for new hire
"""

import os
import json
import re
import time
from datetime import datetime, timedelta
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
# DATA PERSISTENCE
# ═══════════════════════════════════════════════════════════════

HIRING_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output", "hiring")

def _ensure_dirs():
    os.makedirs(HIRING_DATA_DIR, exist_ok=True)

def _load_hiring_data():
    _ensure_dirs()
    path = os.path.join(HIRING_DATA_DIR, "hiring_tracker.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"requirements": [], "profiles": [], "processed_email_ids": []}

def _save_hiring_data(data):
    _ensure_dirs()
    path = os.path.join(HIRING_DATA_DIR, "hiring_tracker.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


# ═══════════════════════════════════════════════════════════════
# STEP 1: SCAN EMAILS FOR NEW REQUIREMENTS
# ═══════════════════════════════════════════════════════════════

REQUIREMENT_KEYWORDS = [
    "looking for", "open position", "need a resource", "requirement",
    "hiring", "new position", "headcount", "need someone", "need developer",
    "resource requirement", "staffing request", "need consultant",
    "open req", "job opening", "new requirement", "need a",
    "urgently need", "resource needed", "position for", "developer for",
    "consultant for", "engineer for", "analyst for", "manager for",
    "onsite resource", "offshore resource", "new hire", "backfill",
]

PARSE_REQUIREMENT_PROMPT = """You parse emails about new hiring/staffing requirements for D4 Insight (IT staffing company working with Visual Comfort & Co).

From the email, extract:
- title: Short position title (e.g. "Senior D365 FO Developer")
- description: Brief description of the role
- project: Which project group this is for (IT_ALL, D365_FO, IT_Support_Savannah, QA_QC, JDE_EDI, Enterprise_Integration, Salesforce, PartnerInsight, Web_B2B, or "New")
- skills: Comma-separated required skills
- location_type: "onsite", "offshore", or "hybrid" (default "offshore")
- location_detail: City if mentioned
- positions_count: Number of positions (default 1)
- priority: "low", "medium", "high", or "urgent"
- sender_name: Who sent the requirement
- sender_email: Their email
- is_vague: true if the email is missing CRITICAL info (role/title unclear, no skills mentioned, no project context). false if enough info to proceed.
- missing_fields: array of field names that are missing or unclear (e.g. ["skills", "project", "location_type"])
- clarification_questions: array of specific, professional questions to ask the sender for the missing info. Only include if is_vague is true.

If the email is NOT about a new hiring requirement, return: {"is_requirement": false}

Return ONLY valid JSON. Examples:

Clear requirement:
{
  "is_requirement": true,
  "is_vague": false,
  "missing_fields": [],
  "title": "Senior Salesforce Developer",
  "description": "Need experienced SF developer for Lightning migration",
  "project": "Salesforce",
  "skills": "Salesforce, Apex, Lightning, LWC",
  "location_type": "offshore",
  "location_detail": "Chennai",
  "positions_count": 1,
  "priority": "high",
  "sender_name": "Anand Pandy",
  "sender_email": "anand.pandy@d4insight.com"
}

Vague requirement:
{
  "is_requirement": true,
  "is_vague": true,
  "missing_fields": ["skills", "project", "location_type", "priority"],
  "clarification_questions": [
    "What specific technical skills or experience are you looking for?",
    "Which project/team will this resource be assigned to?",
    "Do you need this resource onsite (Houston) or offshore?",
    "How urgent is this requirement — can you share a target start date?"
  ],
  "title": "Developer",
  "description": "Need a developer for the project",
  "project": "",
  "skills": "",
  "location_type": "offshore",
  "positions_count": 1,
  "priority": "medium",
  "sender_name": "John Smith",
  "sender_email": "john@example.com"
}"""


def _send_clarification_email(parsed, email_subject, automation_module):
    """Send a clarification email when the requirement is too vague."""
    sender_name = parsed.get("sender_name", "Team")
    sender_email = parsed.get("sender_email", "")
    first_name = sender_name.split()[0] if sender_name else "Team"
    questions = parsed.get("clarification_questions", [])
    missing = parsed.get("missing_fields", [])
    partial_title = parsed.get("title", "New Position")

    if not sender_email or "@" not in sender_email:
        print("    -> No sender email for clarification")
        return

    questions_html = "".join(f"<li style='margin-bottom: 8px;'>{q}</li>" for q in questions)
    missing_html = ", ".join(f"<strong>{f.replace('_', ' ').title()}</strong>" for f in missing)

    subject = f"Re: {email_subject} — Need a few more details"
    html_body = f"""
    <div style="font-family: Calibri, sans-serif; font-size: 14px; color: #333;">
        <p>Hi {first_name},</p>

        <p>Thank you for reaching out regarding the <strong>{partial_title}</strong> requirement.
        We'd love to get started on this right away, but we need a few more details to ensure
        we find the right fit:</p>

        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 15px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">Could you please clarify:</p>
            <ol style="margin: 0; padding-left: 20px; color: #334155;">
                {questions_html}
            </ol>
        </div>

        <p style="color: #64748b; font-size: 13px;">Missing info: {missing_html}</p>

        <p>Once we have these details, we'll immediately generate a Job Description and start
        sourcing candidates. Just reply to this email with the information.</p>

        <p>Thanks,<br>
        <strong>D4 Insight</strong> — VCC Workforce Management<br>
        <span style="color: #94a3b8; font-size: 12px;">This is an automated message from our hiring pipeline system</span></p>
    </div>
    """

    to_emails = [sender_email]
    cc_emails = [e for e in [automation_module.ANAND_EMAIL, automation_module.KISHAN_EMAIL]
                 if e and "@" in e and e != sender_email]

    try:
        automation_module.send_email(
            automation_module.SENDER_EMAIL,
            to_emails, cc_emails,
            subject, html_body
        )
        print(f"    -> Clarification email sent to {sender_email} (missing: {', '.join(missing)})")
    except Exception as e:
        print(f"    -> Clarification email error: {e}")


def scan_requirement_emails(automation_module):
    """Scan sysadmin mailbox for new requirement emails."""
    print("\n  Scanning mailbox for new hiring requirements...")

    data = _load_hiring_data()
    processed_ids = set(data.get("processed_email_ids", []))

    # Search for emails with requirement keywords
    search_query = " OR ".join([f'"{kw}"' for kw in REQUIREMENT_KEYWORDS[:5]])
    try:
        url = f"/users/{automation_module.SENDER_EMAIL}/messages?$filter=receivedDateTime ge {(datetime.utcnow() - timedelta(days=14)).strftime('%Y-%m-%dT00:00:00Z')}&$top=50&$select=id,subject,body,from,receivedDateTime&$orderby=receivedDateTime desc"
        result = automation_module.graph_get(url)
    except Exception as e:
        print(f"  ERROR reading mailbox: {e}")
        return []

    emails = result.get("value", [])
    new_requirements = []
    claude = get_claude()

    for email in emails:
        email_id = email.get("id", "")
        if email_id in processed_ids:
            continue

        subject = email.get("subject", "")
        body_content = email.get("body", {}).get("content", "")
        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")

        # Skip emails sent BY sysadmin (our own ack/JD emails)
        if from_addr.lower() == automation_module.SENDER_EMAIL.lower():
            processed_ids.add(email_id)
            continue

        # Quick keyword check before calling AI
        combined = (subject + " " + body_content).lower()
        if not any(kw in combined for kw in REQUIREMENT_KEYWORDS):
            continue

        print(f"    Checking: {subject[:60]}... from {from_name}")

        # Use Claude to parse
        try:
            # Strip HTML tags for cleaner input
            clean_body = re.sub(r'<[^>]+>', ' ', body_content)
            clean_body = re.sub(r'\s+', ' ', clean_body).strip()[:3000]

            response = claude.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=800,
                system=PARSE_REQUIREMENT_PROMPT,
                messages=[{"role": "user", "content": f"Subject: {subject}\nFrom: {from_name} <{from_addr}>\n\n{clean_body}\n\nIMPORTANT: Return ONLY a raw JSON object, no markdown, no explanation, no code fences."}]
            )

            raw_text = response.content[0].text.strip()
            # Extract JSON if wrapped in code fences
            json_match = re.search(r'\{[\s\S]*\}', raw_text)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(raw_text)

            if parsed.get("is_requirement") == False:
                processed_ids.add(email_id)
                continue

            # Check if the requirement is too vague
            if parsed.get("is_vague") and parsed.get("clarification_questions"):
                print(f"    -> VAGUE REQUIREMENT detected: {parsed.get('title', 'Unknown')}")
                print(f"       Missing: {', '.join(parsed.get('missing_fields', []))}")

                # Send clarification email
                _send_clarification_email(parsed, subject, automation_module)

                # Save as pending (not open) so we don't generate JD yet
                req = {
                    "id": f"REQ-{datetime.now().strftime('%Y%m%d%H%M%S')}-{len(data['requirements'])+1}",
                    "email_id": email_id,
                    "title": parsed.get("title", subject),
                    "description": parsed.get("description", ""),
                    "project": parsed.get("project", ""),
                    "skills": parsed.get("skills", ""),
                    "location_type": parsed.get("location_type", "offshore"),
                    "location_detail": parsed.get("location_detail", ""),
                    "positions_count": parsed.get("positions_count", 1),
                    "priority": parsed.get("priority", "medium"),
                    "sender_name": parsed.get("sender_name", from_name),
                    "sender_email": parsed.get("sender_email", from_addr),
                    "status": "pending_clarification",
                    "missing_fields": parsed.get("missing_fields", []),
                    "profiles": [],
                    "jd_generated": False,
                    "created_at": datetime.now().isoformat(),
                    "received_date": email.get("receivedDateTime", ""),
                }
                data["requirements"].append(req)
                _sync_requirement_to_supabase(req, automation_module)
                print(f"    -> Saved as PENDING CLARIFICATION")
            else:
                # Clear requirement — proceed with full pipeline
                req = {
                    "id": f"REQ-{datetime.now().strftime('%Y%m%d%H%M%S')}-{len(data['requirements'])+1}",
                    "email_id": email_id,
                    "title": parsed.get("title", subject),
                    "description": parsed.get("description", ""),
                    "project": parsed.get("project", ""),
                    "skills": parsed.get("skills", ""),
                    "location_type": parsed.get("location_type", "offshore"),
                    "location_detail": parsed.get("location_detail", ""),
                    "positions_count": parsed.get("positions_count", 1),
                    "priority": parsed.get("priority", "medium"),
                    "sender_name": parsed.get("sender_name", from_name),
                    "sender_email": parsed.get("sender_email", from_addr),
                    "status": "open",
                    "profiles": [],
                    "jd_generated": False,
                    "created_at": datetime.now().isoformat(),
                    "received_date": email.get("receivedDateTime", ""),
                }

                data["requirements"].append(req)
                new_requirements.append(req)
                print(f"    -> NEW REQUIREMENT: {req['title']} ({req['project']}) [{req['priority']}]")

                # Sync to Supabase
                _sync_requirement_to_supabase(req, automation_module)

        except Exception as e:
            print(f"    Parse error: {e}")

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    _save_hiring_data(data)

    if new_requirements:
        print(f"\n  Found {len(new_requirements)} new requirement(s).")
    else:
        print("  No new requirements found.")

    return new_requirements


def _sync_requirement_to_supabase(req, automation_module):
    """Insert requirement into Supabase dashboard."""
    sb = automation_module.get_supabase()
    if not sb:
        return

    try:
        sb.table("requirements").insert({
            "title": req["title"],
            "description": req["description"],
            "project": req["project"],
            "skills": req["skills"],
            "location_type": req["location_type"],
            "location_detail": req.get("location_detail", ""),
            "positions_count": req.get("positions_count", 1),
            "priority": req.get("priority", "medium"),
            "status": "open",
            "created_by": req.get("sender_email", ""),
        }).execute()
        print(f"    -> Synced to dashboard")
    except Exception as e:
        print(f"    Dashboard sync error: {e}")


# ═══════════════════════════════════════════════════════════════
# STEP 2: AI-GENERATE JOB DESCRIPTION
# ═══════════════════════════════════════════════════════════════

JD_SYSTEM_PROMPT = """You are an expert technical recruiter writing Job Descriptions for D4 Insight, an IT consulting company.

Write a professional, detailed JD based on the requirement provided. Include:

1. **Position Title**
2. **Company**: D4 Insight (IT consulting for Visual Comfort & Co.)
3. **Location**: As specified
4. **About the Role**: 2-3 paragraph overview
5. **Key Responsibilities**: 6-8 bullet points
6. **Required Skills & Qualifications**: 6-8 bullet points
7. **Preferred/Nice-to-Have**: 3-4 bullet points
8. **Experience**: Years required
9. **What We Offer**: Standard benefits (competitive salary, remote work options, learning opportunities)

Keep it professional but concise. Do NOT include salary ranges.
Output in clean markdown format."""


def generate_jd(req_id, automation_module):
    """Generate a Job Description using Claude AI for a requirement."""
    data = _load_hiring_data()

    # Find requirement
    req = None
    for r in data["requirements"]:
        if r["id"] == req_id:
            req = r
            break

    if not req:
        # Try matching by Supabase ID or partial match
        for r in data["requirements"]:
            if req_id in r["id"] or r.get("title", "").lower().startswith(req_id.lower()):
                req = r
                break

    if not req:
        print(f"  ERROR: Requirement '{req_id}' not found.")
        print(f"  Available: {[r['id'] + ' - ' + r['title'] for r in data['requirements']]}")
        return None

    print(f"\n  Generating JD for: {req['title']}")
    print(f"  Project: {req['project']} | Skills: {req['skills']}")

    claude = get_claude()

    prompt = f"""Generate a Job Description for this position:

Title: {req['title']}
Project: {req['project']}
Description: {req['description']}
Required Skills: {req['skills']}
Location: {req['location_type']} {req.get('location_detail', '')}
Positions: {req['positions_count']}
Priority: {req['priority']}"""

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=JD_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        jd_text = response.content[0].text

        # Save JD to file
        _ensure_dirs()
        jd_dir = os.path.join(HIRING_DATA_DIR, "jds")
        os.makedirs(jd_dir, exist_ok=True)
        safe_title = re.sub(r'[^\w\s-]', '', req['title']).strip().replace(' ', '_')
        jd_path = os.path.join(jd_dir, f"JD_{safe_title}_{datetime.now().strftime('%Y%m%d')}.md")

        with open(jd_path, "w", encoding="utf-8") as f:
            f.write(jd_text)

        # Update tracker
        req["jd_generated"] = True
        req["jd_path"] = jd_path
        req["jd_generated_at"] = datetime.now().isoformat()
        _save_hiring_data(data)

        print(f"\n  JD saved to: {jd_path}")
        print(f"\n  --- Preview ---")
        # Show first 20 lines
        for line in jd_text.split('\n')[:20]:
            print(f"  {line}")
        print(f"  ... ({len(jd_text)} chars total)")

        return jd_path

    except Exception as e:
        print(f"  ERROR generating JD: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# STEP 3: TRACK PROFILES FROM RECRUITMENT
# ═══════════════════════════════════════════════════════════════

PARSE_PROFILE_PROMPT = """You parse emails about candidate profiles/resumes sent for hiring at D4 Insight.

Extract:
- candidate_name: Full name of the candidate
- position: What role they're applying for
- skills: Key skills mentioned
- experience_years: Years of experience if mentioned
- sender_name: Who sent the profile (recruiter name)
- sender_email: Recruiter email
- attachment_mentioned: true/false if resume/CV is attached

If the email is NOT about a candidate profile, return: {"is_profile": false}

Return ONLY valid JSON."""


def scan_profile_emails(automation_module):
    """Scan for profile/resume submissions from recruitment team."""
    print("\n  Scanning for candidate profiles...")

    data = _load_hiring_data()
    processed_ids = set(data.get("processed_email_ids", []))

    profile_keywords = ["resume", "profile", "candidate", "cv attached", "shortlisted",
                        "applying for", "experience in"]

    try:
        url = f"/users/{automation_module.SENDER_EMAIL}/messages?$filter=receivedDateTime ge {(datetime.utcnow() - timedelta(days=14)).strftime('%Y-%m-%dT00:00:00Z')}&$top=50&$select=id,subject,body,from,receivedDateTime,hasAttachments&$orderby=receivedDateTime desc"
        result = automation_module.graph_get(url)
    except Exception as e:
        print(f"  ERROR reading mailbox: {e}")
        return []

    emails = result.get("value", [])
    new_profiles = []
    claude = get_claude()

    for email in emails:
        email_id = email.get("id", "")
        if email_id in processed_ids:
            continue

        subject = email.get("subject", "")
        body_content = email.get("body", {}).get("content", "")
        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        from_name = email.get("from", {}).get("emailAddress", {}).get("name", "")

        # Skip emails sent BY sysadmin
        if from_addr.lower() == automation_module.SENDER_EMAIL.lower():
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
                system=PARSE_PROFILE_PROMPT,
                messages=[{"role": "user", "content": f"Subject: {subject}\nFrom: {from_name} <{from_addr}>\nHas Attachments: {email.get('hasAttachments', False)}\n\n{clean_body}"}]
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
                    "status": "received",  # received -> shortlisted -> interview -> selected -> offer -> onboarding
                    "received_date": email.get("receivedDateTime", ""),
                    "created_at": datetime.now().isoformat(),
                }

                # Try to match to an open requirement
                matched_req = _match_profile_to_requirement(profile, data["requirements"])
                if matched_req:
                    profile["requirement_id"] = matched_req["id"]
                    matched_req.setdefault("profiles", []).append(profile["id"])
                    print(f"    -> Matched to: {matched_req['title']}")

                data["profiles"].append(profile)
                new_profiles.append(profile)
                print(f"    NEW PROFILE: {profile['candidate_name']} for {profile['position']}")

        except Exception as e:
            print(f"    Parse error: {e}")

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    _save_hiring_data(data)

    if new_profiles:
        print(f"\n  Found {len(new_profiles)} new profile(s).")
    else:
        print("  No new profiles found.")

    return new_profiles


def _match_profile_to_requirement(profile, requirements):
    """Try to match a profile to an open requirement by position/skills."""
    position = (profile.get("position", "") + " " + profile.get("skills", "")).lower()
    best_match = None
    best_score = 0

    for req in requirements:
        if req["status"] != "open":
            continue
        req_text = (req.get("title", "") + " " + req.get("skills", "") + " " + req.get("project", "")).lower()
        # Simple keyword overlap scoring
        req_words = set(req_text.split())
        pos_words = set(position.split())
        overlap = len(req_words & pos_words)
        if overlap > best_score:
            best_score = overlap
            best_match = req

    return best_match if best_score >= 2 else None


# ═══════════════════════════════════════════════════════════════
# STEP 4: INTERVIEW TRACKING
# ═══════════════════════════════════════════════════════════════

def update_profile_status(profile_id, new_status, data=None):
    """Update a candidate profile's status."""
    if data is None:
        data = _load_hiring_data()

    valid_statuses = ["received", "shortlisted", "interview_scheduled", "interviewed",
                      "selected", "rejected", "offer_sent", "offer_accepted",
                      "onboarding", "joined", "bench"]

    if new_status not in valid_statuses:
        print(f"  ERROR: Invalid status '{new_status}'")
        print(f"  Valid: {', '.join(valid_statuses)}")
        return False

    for profile in data["profiles"]:
        if profile["id"] == profile_id or profile.get("candidate_name", "").lower().startswith(profile_id.lower()):
            old_status = profile["status"]
            profile["status"] = new_status
            profile[f"{new_status}_at"] = datetime.now().isoformat()
            _save_hiring_data(data)
            print(f"  {profile['candidate_name']}: {old_status} -> {new_status}")
            return True

    print(f"  ERROR: Profile '{profile_id}' not found.")
    return False


# ═══════════════════════════════════════════════════════════════
# STEP 5: ONBOARDING EMAIL
# ═══════════════════════════════════════════════════════════════

def send_onboarding_email(candidate_name, automation_module):
    """Send onboarding kickoff email for a new hire."""
    data = _load_hiring_data()

    # Find the profile
    profile = None
    for p in data["profiles"]:
        if p["candidate_name"].lower().startswith(candidate_name.lower()):
            profile = p
            break

    if not profile:
        print(f"  ERROR: No profile found for '{candidate_name}'")
        return False

    # Find associated requirement
    req = None
    if profile.get("requirement_id"):
        for r in data["requirements"]:
            if r["id"] == profile["requirement_id"]:
                req = r
                break

    position = req["title"] if req else profile.get("position", "New Position")
    project = req["project"] if req else ""

    print(f"\n  Sending onboarding email for: {profile['candidate_name']}")
    print(f"  Position: {position} | Project: {project}")

    subject = f"New Resource Onboarding - {profile['candidate_name']} - {position}"

    html_body = f"""
    <div style="font-family: Calibri, sans-serif; font-size: 14px; color: #333;">
        <p>Hi Team,</p>

        <p>Please initiate the onboarding process for the following new resource:</p>

        <table style="border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 6px 15px; font-weight: bold; background: #f0f4f8;">Name</td>
                <td style="padding: 6px 15px;">{profile['candidate_name']}</td></tr>
            <tr><td style="padding: 6px 15px; font-weight: bold; background: #f0f4f8;">Position</td>
                <td style="padding: 6px 15px;">{position}</td></tr>
            <tr><td style="padding: 6px 15px; font-weight: bold; background: #f0f4f8;">Project</td>
                <td style="padding: 6px 15px;">{project}</td></tr>
            <tr><td style="padding: 6px 15px; font-weight: bold; background: #f0f4f8;">Skills</td>
                <td style="padding: 6px 15px;">{profile.get('skills', 'N/A')}</td></tr>
        </table>

        <p><strong>Onboarding Checklist:</strong></p>
        <ul>
            <li>Laptop/hardware allocation and setup</li>
            <li>Azure AD account creation</li>
            <li>Email account setup</li>
            <li>Teams access & channel assignment</li>
            <li>Project access & permissions</li>
            <li>VPN configuration (if onsite/hybrid)</li>
            <li>Timesheet system enrollment</li>
            <li>Manager introduction & team assignment</li>
        </ul>

        <p>Please confirm once the above items are completed.</p>

        <p>Thanks,<br>
        <span style="color: #666;">VCC Workforce Management System</span></p>
    </div>
    """

    # Send to Anand, Kishan, and the resource's manager
    to_emails = [automation_module.ANAND_EMAIL, automation_module.KISHAN_EMAIL]
    cc_emails = [automation_module.AR_EMAIL]

    try:
        automation_module.send_email(
            automation_module.SENDER_EMAIL,
            to_emails, cc_emails,
            subject, html_body
        )
        profile["status"] = "onboarding"
        profile["onboarding_at"] = datetime.now().isoformat()
        _save_hiring_data(data)
        print(f"  Onboarding email sent successfully.")
        return True
    except Exception as e:
        print(f"  ERROR sending onboarding email: {e}")
        return False


# ═══════════════════════════════════════════════════════════════
# STEP 6: BENCH TRACKING
# ═══════════════════════════════════════════════════════════════

def check_bench_resources(automation_module):
    """Check for resources on bench and send laptop handover reminders."""
    data = _load_hiring_data()

    bench_profiles = [p for p in data["profiles"] if p["status"] == "bench"]
    if not bench_profiles:
        print("  No resources on bench.")
        return

    print(f"\n  Resources on bench: {len(bench_profiles)}")
    for p in bench_profiles:
        bench_date = p.get("bench_at", p.get("created_at", ""))
        if bench_date:
            try:
                bench_dt = datetime.fromisoformat(bench_date.replace("Z", ""))
                days_on_bench = (datetime.now() - bench_dt).days
                print(f"    {p['candidate_name']} - {days_on_bench} days on bench")

                # Auto-send laptop handover email after 7 days on bench
                if days_on_bench >= 7 and not p.get("laptop_reminder_sent"):
                    _send_laptop_handover_email(p, automation_module)
                    p["laptop_reminder_sent"] = True
                    _save_hiring_data(data)
            except:
                print(f"    {p['candidate_name']} - bench date unknown")


def _send_laptop_handover_email(profile, automation_module):
    """Send laptop handover reminder for bench resource."""
    subject = f"Laptop Handover Required - {profile['candidate_name']} (On Bench)"
    html_body = f"""
    <div style="font-family: Calibri, sans-serif; font-size: 14px; color: #333;">
        <p>Hi Team,</p>
        <p><strong>{profile['candidate_name']}</strong> has been on bench for 7+ days.
        Please initiate the laptop/asset handover process.</p>
        <p>Thanks,<br>
        <span style="color: #666;">VCC Workforce Management System</span></p>
    </div>
    """

    try:
        automation_module.send_email(
            automation_module.SENDER_EMAIL,
            [automation_module.KISHAN_EMAIL],
            [],
            subject, html_body
        )
        print(f"    -> Laptop handover email sent for {profile['candidate_name']}")
    except Exception as e:
        print(f"    -> Email error: {e}")


# ═══════════════════════════════════════════════════════════════
# STATUS DISPLAY
# ═══════════════════════════════════════════════════════════════

def hiring_status():
    """Display full hiring pipeline status."""
    data = _load_hiring_data()

    reqs = data.get("requirements", [])
    profiles = data.get("profiles", [])

    print("\n  ╔══════════════════════════════════════════════════════╗")
    print("  ║          HIRING PIPELINE STATUS                     ║")
    print("  ╚══════════════════════════════════════════════════════╝")

    # Requirements summary
    open_reqs = [r for r in reqs if r["status"] == "open"]
    pending_reqs = [r for r in reqs if r["status"] == "pending_clarification"]
    on_hold = [r for r in reqs if r["status"] == "on_hold"]
    closed = [r for r in reqs if r["status"] == "closed"]

    print(f"\n  Requirements: {len(reqs)} total | {len(open_reqs)} open | {len(pending_reqs)} pending clarification | {len(on_hold)} on hold | {len(closed)} closed")

    if pending_reqs:
        print("\n  Awaiting Clarification:")
        for r in pending_reqs:
            missing = ', '.join(r.get('missing_fields', []))
            print(f"    [{r['id']}] {r['title']} from {r.get('sender_name', '?')} — missing: {missing}")

    if open_reqs:
        print("\n  Open Requirements:")
        for r in open_reqs:
            profiles_count = len(r.get("profiles", []))
            jd = "JD ready" if r.get("jd_generated") else "No JD"
            print(f"    [{r['id']}] {r['title']} ({r['project']}) - {r['priority']} | {profiles_count} profiles | {jd}")

    # Profile pipeline
    status_counts = {}
    for p in profiles:
        s = p.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    if profiles:
        print(f"\n  Profiles: {len(profiles)} total")
        pipeline_order = ["received", "shortlisted", "interview_scheduled", "interviewed",
                          "selected", "rejected", "offer_sent", "offer_accepted",
                          "onboarding", "joined", "bench"]
        for status in pipeline_order:
            count = status_counts.get(status, 0)
            if count > 0:
                bar = "█" * count
                print(f"    {status:>22}: {bar} {count}")

        # Show recent profiles
        recent = sorted(profiles, key=lambda p: p.get("created_at", ""), reverse=True)[:5]
        if recent:
            print(f"\n  Recent Profiles:")
            for p in recent:
                print(f"    {p['candidate_name']} | {p.get('position', 'N/A')} | {p['status']} | {p.get('received_date', '')[:10]}")

    if not reqs and not profiles:
        print("\n  No hiring data yet. Run 'hire-scan' to scan emails for requirements.")


# ═══════════════════════════════════════════════════════════════
# SOW EDITING (Placeholder - needs template from user)
# ═══════════════════════════════════════════════════════════════

SOW_EDIT_PROMPT = """You are editing a Statement of Work (SOW) document for D4 Insight.
Given the template and the new resource details, update ONLY the following fields:
- Resource name
- Position/Role title
- Start date
- Rate/billing details
- Project assignment
- Skills/qualifications

Keep all other template content exactly as-is. Return the complete edited SOW."""


def edit_sow_from_template(template_path, resource_details):
    """Edit SOW template with new resource details using AI."""
    if not os.path.exists(template_path):
        print(f"  ERROR: Template not found at {template_path}")
        return None

    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    claude = get_claude()

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=SOW_EDIT_PROMPT,
            messages=[{"role": "user", "content": f"Template:\n{template}\n\nNew Resource Details:\n{json.dumps(resource_details, indent=2)}"}]
        )

        edited_sow = response.content[0].text

        # Save edited SOW
        _ensure_dirs()
        sow_dir = os.path.join(HIRING_DATA_DIR, "sow")
        os.makedirs(sow_dir, exist_ok=True)
        name = resource_details.get("name", "unknown").replace(" ", "_")
        sow_path = os.path.join(sow_dir, f"SOW_{name}_{datetime.now().strftime('%Y%m%d')}.md")

        with open(sow_path, "w", encoding="utf-8") as f:
            f.write(edited_sow)

        print(f"  SOW saved to: {sow_path}")
        return sow_path

    except Exception as e:
        print(f"  ERROR editing SOW: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# AUTO-WATCH: CONTINUOUS MAILBOX MONITORING
# ═══════════════════════════════════════════════════════════════

def _send_ack_email(req, automation_module):
    """Send acknowledgment email back to the requirement sender."""
    subject = f"Re: Requirement Received - {req['title']} [{req['id']}]"
    html_body = f"""
    <div style="font-family: Calibri, sans-serif; font-size: 14px; color: #333;">
        <p>Hi {req['sender_name'].split()[0] if req.get('sender_name') else 'Team'},</p>

        <p>We have received your requirement and it has been logged in our system.</p>

        <table style="border-collapse: collapse; margin: 15px 0; border: 1px solid #e2e8f0;">
            <tr><td style="padding: 8px 15px; font-weight: bold; background: #f0f4f8; border: 1px solid #e2e8f0;">Tracking ID</td>
                <td style="padding: 8px 15px; border: 1px solid #e2e8f0; font-family: monospace;">{req['id']}</td></tr>
            <tr><td style="padding: 8px 15px; font-weight: bold; background: #f0f4f8; border: 1px solid #e2e8f0;">Position</td>
                <td style="padding: 8px 15px; border: 1px solid #e2e8f0;">{req['title']}</td></tr>
            <tr><td style="padding: 8px 15px; font-weight: bold; background: #f0f4f8; border: 1px solid #e2e8f0;">Project</td>
                <td style="padding: 8px 15px; border: 1px solid #e2e8f0;">{req.get('project', 'TBD')}</td></tr>
            <tr><td style="padding: 8px 15px; font-weight: bold; background: #f0f4f8; border: 1px solid #e2e8f0;">Skills</td>
                <td style="padding: 8px 15px; border: 1px solid #e2e8f0;">{req.get('skills', 'N/A')}</td></tr>
            <tr><td style="padding: 8px 15px; font-weight: bold; background: #f0f4f8; border: 1px solid #e2e8f0;">Priority</td>
                <td style="padding: 8px 15px; border: 1px solid #e2e8f0;">{req.get('priority', 'medium').upper()}</td></tr>
            <tr><td style="padding: 8px 15px; font-weight: bold; background: #f0f4f8; border: 1px solid #e2e8f0;">Positions</td>
                <td style="padding: 8px 15px; border: 1px solid #e2e8f0;">{req.get('positions_count', 1)}</td></tr>
        </table>

        <p><strong>Next Steps:</strong></p>
        <ul>
            <li>Job Description is being auto-generated</li>
            <li>Recruitment team will be notified</li>
            <li>Profiles will be tracked as they come in</li>
        </ul>

        <p>You can track the status on the <a href="https://d4insight-vcc.vercel.app/admin/requirements">Hiring Board</a>.</p>

        <p>Thanks,<br>
        <span style="color: #666;">D4 Insight - VCC Workforce Automation</span></p>
    </div>
    """

    to_emails = [req.get("sender_email", "")]
    cc_emails = [automation_module.ANAND_EMAIL, automation_module.KISHAN_EMAIL]
    # Remove empty/duplicate emails
    to_emails = [e for e in to_emails if e and "@" in e]
    cc_emails = [e for e in cc_emails if e and "@" in e and e not in to_emails]

    if not to_emails:
        print("    -> No sender email to acknowledge")
        return

    try:
        automation_module.send_email(
            automation_module.SENDER_EMAIL,
            to_emails, cc_emails,
            subject, html_body
        )
        print(f"    -> Acknowledgment sent to {to_emails[0]}")
    except Exception as e:
        print(f"    -> Ack email error: {e}")


def _auto_generate_jd(req, automation_module):
    """Auto-generate JD for a newly detected requirement."""
    print(f"    -> Auto-generating JD for: {req['title']}")
    jd_path = generate_jd(req["id"], automation_module)

    if jd_path:
        # Email the JD to the recruitment team
        try:
            with open(jd_path, "r", encoding="utf-8") as f:
                jd_content = f.read()

            # Convert markdown to basic HTML
            jd_html = jd_content.replace("\n", "<br>")
            jd_html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', jd_html)
            jd_html = re.sub(r'## (.+?)(<br>)', r'<h3>\1</h3>', jd_html)
            jd_html = re.sub(r'# (.+?)(<br>)', r'<h2>\1</h2>', jd_html)

            subject = f"Job Description Ready - {req['title']} [{req['id']}]"
            html_body = f"""
            <div style="font-family: Calibri, sans-serif; font-size: 14px; color: #333;">
                <p>Hi Team,</p>
                <p>A Job Description has been auto-generated for the following requirement:</p>
                <p><strong>Position:</strong> {req['title']}<br>
                <strong>Project:</strong> {req.get('project', 'TBD')}<br>
                <strong>Priority:</strong> {req.get('priority', 'medium').upper()}</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <div>{jd_html}</div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">Auto-generated by D4 Insight VCC Automation</p>
            </div>
            """

            to_emails = [automation_module.ANAND_EMAIL, automation_module.KISHAN_EMAIL]
            if req.get("sender_email"):
                to_emails.append(req["sender_email"])
            to_emails = list(set(e for e in to_emails if e and "@" in e))

            automation_module.send_email(
                automation_module.SENDER_EMAIL,
                to_emails, [],
                subject, html_body
            )
            print(f"    -> JD emailed to team")
        except Exception as e:
            print(f"    -> JD email error: {e}")


def _check_for_clarification_replies(automation_module):
    """Check if anyone replied to our clarification emails with the missing info."""
    data = _load_hiring_data()
    pending = [r for r in data.get("requirements", []) if r["status"] == "pending_clarification"]

    if not pending:
        return []

    processed_ids = set(data.get("processed_email_ids", []))
    resolved = []

    try:
        # Look for recent replies
        url = (f"/users/{automation_module.SENDER_EMAIL}/messages?"
               f"$filter=receivedDateTime ge {(datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%dT00:00:00Z')}"
               f"&$top=30&$select=id,subject,body,from,receivedDateTime,conversationId"
               f"&$orderby=receivedDateTime desc")
        result = automation_module.graph_get(url)
    except Exception as e:
        return []

    emails = result.get("value", [])
    claude = get_claude()

    for email in emails:
        email_id = email.get("id", "")
        if email_id in processed_ids:
            continue

        subject = email.get("subject", "")
        # Check if this is a reply to one of our clarification emails
        if not subject.lower().startswith("re:"):
            continue

        # Match to a pending requirement by subject or sender
        from_addr = email.get("from", {}).get("emailAddress", {}).get("address", "")
        matched_req = None
        for req in pending:
            if (req.get("sender_email", "").lower() == from_addr.lower() or
                req.get("title", "").lower() in subject.lower()):
                matched_req = req
                break

        if not matched_req:
            continue

        body_content = email.get("body", {}).get("content", "")
        clean_body = re.sub(r'<[^>]+>', ' ', body_content)
        clean_body = re.sub(r'\s+', ' ', clean_body).strip()[:3000]

        print(f"    Checking clarification reply for: {matched_req['title']}")

        # Use AI to extract the new info and merge
        try:
            merge_prompt = f"""The original requirement was vague and missing: {', '.join(matched_req.get('missing_fields', []))}.

Original info:
- Title: {matched_req['title']}
- Description: {matched_req['description']}
- Project: {matched_req['project']}
- Skills: {matched_req['skills']}
- Location: {matched_req['location_type']}

The sender has replied with additional details. Extract the new info and return a COMPLETE updated requirement.
Return ONLY valid JSON with ALL fields filled in (merge original + new info):
{{"title": "...", "description": "...", "project": "...", "skills": "...", "location_type": "...", "location_detail": "...", "positions_count": 1, "priority": "...", "is_complete": true/false}}

If the reply still doesn't provide enough info, set is_complete to false."""

            response = claude.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=500,
                system=merge_prompt,
                messages=[{"role": "user", "content": f"Reply from sender:\n{clean_body}"}]
            )

            updated = json.loads(response.content[0].text)

            if updated.get("is_complete", True):
                # Update the requirement with new info
                for field in ["title", "description", "project", "skills", "location_type", "location_detail", "positions_count", "priority"]:
                    if updated.get(field):
                        matched_req[field] = updated[field]
                matched_req["status"] = "open"
                matched_req["clarification_resolved_at"] = datetime.now().isoformat()
                del_fields = ["missing_fields"]
                for f in del_fields:
                    matched_req.pop(f, None)

                resolved.append(matched_req)
                print(f"    -> CLARIFICATION RESOLVED: {matched_req['title']} -> now OPEN")

                # Update Supabase
                _sync_requirement_to_supabase(matched_req, automation_module)
            else:
                print(f"    -> Reply still incomplete, keeping as pending")

        except Exception as e:
            print(f"    -> Parse reply error: {e}")

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    _save_hiring_data(data)

    return resolved


def _check_for_status_update_emails(automation_module):
    """Check for emails that indicate interview/selection/rejection updates."""
    data = _load_hiring_data()
    processed_ids = set(data.get("processed_email_ids", []))

    status_keywords = [
        "selected", "shortlisted", "interview scheduled", "rejected",
        "offer accepted", "offer sent", "joined", "onboarding",
        "not suitable", "moved forward", "final round", "cleared interview"
    ]

    try:
        url = (f"/users/{automation_module.SENDER_EMAIL}/messages?"
               f"$filter=receivedDateTime ge {(datetime.utcnow() - timedelta(days=3)).strftime('%Y-%m-%dT00:00:00Z')}"
               f"&$top=30&$select=id,subject,body,from,receivedDateTime&$orderby=receivedDateTime desc")
        result = automation_module.graph_get(url)
    except Exception as e:
        return

    emails = result.get("value", [])
    claude = get_claude()

    STATUS_PARSE_PROMPT = """You parse emails about candidate hiring status updates at D4 Insight.

Extract:
- candidate_name: Name of the candidate being discussed
- new_status: One of: shortlisted, interview_scheduled, interviewed, selected, rejected, offer_sent, offer_accepted, onboarding, joined
- notes: Brief context

If the email is NOT about a candidate status update, return: {"is_update": false}
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
                    updated = update_profile_status(name, new_status, data)
                    if updated:
                        print(f"    -> Auto-updated: {name} -> {new_status}")

                        # If offer accepted, auto-trigger onboarding
                        if new_status == "offer_accepted":
                            print(f"    -> Triggering onboarding for {name}...")
                            send_onboarding_email(name, automation_module)

        except Exception:
            pass

        processed_ids.add(email_id)

    data["processed_email_ids"] = list(processed_ids)
    _save_hiring_data(data)


def _get_timesheet_schedule_action(today=None):
    """Determine what timesheet action to run based on current date.

    Fortnightly periods: 1st-15th and 16th-end of month.
    Schedule:
      Day 13 or 28 (2 days before period end): check completion, ping missing
      Day 14 or last-1 day: generate consolidated Excel
      Day 15 or 1st of next period: send to Anand for review
      Any day: check for Anand's reply and auto-process feedback
    """
    if today is None:
        today = datetime.now()

    day = today.day

    # First half period (1-15)
    if day <= 15:
        if day == 13:
            return "check"
        elif day == 14:
            return "generate"
        elif day == 15:
            return "send-anand"
    else:
        # Second half period (16-end)
        # Get last day of month
        if today.month == 12:
            last_day = 31
        else:
            last_day = (today.replace(month=today.month + 1, day=1) - timedelta(days=1)).day

        if day == last_day - 2:
            return "check"
        elif day == last_day - 1:
            return "generate"
        elif day == last_day:
            return "send-anand"

    return "monitor"  # Default: just monitor for Anand's reply


def _run_timesheet_step(action, automation_module):
    """Execute a timesheet automation step."""
    try:
        period_label = automation_module.get_current_period()
        period_dir = os.path.join(
            os.path.dirname(os.path.abspath(automation_module.__file__)),
            "..", "output", "timesheets", period_label
        )

        if action == "check":
            print(f"  >> TIMESHEET [{period_label}]: Checking completion & pinging missing...")
            # Get submitted names from Supabase
            sb = automation_module.get_supabase()
            submitted_names = []
            if sb:
                try:
                    res = sb.table("timesheets").select("user_id").eq("period", period_label).eq("status", "submitted").execute()
                    user_ids = [r["user_id"] for r in (res.data or [])]
                    if user_ids:
                        users_res = sb.table("users").select("name").in_("id", user_ids).execute()
                        submitted_names = [u["name"] for u in (users_res.data or [])]
                except Exception as e:
                    print(f"  >> Could not fetch submissions from Supabase: {e}")
            automation_module.check_completion(period_label, submitted_names)

        elif action == "generate":
            print(f"  >> TIMESHEET [{period_label}]: Generating consolidated Excel...")
            automation_module.generate_excel(period_label)

        elif action == "send-anand":
            if os.path.exists(period_dir) and any(f.endswith(".xlsx") for f in os.listdir(period_dir)):
                print(f"  >> TIMESHEET [{period_label}]: Sending to Anand for review...")
                automation_module.send_to_anand(period_dir, period_label)
            else:
                print(f"  >> TIMESHEET [{period_label}]: No Excel files found, generating first...")
                automation_module.generate_excel(period_label)
                if os.path.exists(period_dir):
                    automation_module.send_to_anand(period_dir, period_label)

        elif action == "monitor":
            # Check if Anand replied with feedback
            try:
                from ai_review import check_and_process_review
                check_and_process_review(automation_module)
            except ImportError:
                pass
            except Exception as e:
                err_str = str(e).lower()
                if "no review" not in err_str and "not found" not in err_str:
                    print(f"  >> AI Review: {e}")

    except Exception as e:
        print(f"  >> TIMESHEET {action} error: {e}")


def run_hire_watch(automation_module, interval_minutes=5):
    """
    Continuous watch mode - polls sysadmin mailbox and auto-triggers full pipeline.

    Handles:
    A. HIRING: requirements, profiles, JD generation, onboarding
    B. LEAVES: auto-detect and sync leave requests
    C. TIMESHEETS: fortnightly auto-consolidation on schedule

    Flow when a requirement CC'd to sysadmin is detected:
    1. Parse requirement from email (AI)
    2. Create in Supabase dashboard
    3. Send acknowledgment email to sender
    4. Auto-generate Job Description (AI)
    5. Email JD to Anand + Kishan + sender
    6. Continue watching for profile submissions
    7. Auto-detect interview/selection/rejection emails
    8. Auto-trigger onboarding when offer accepted
    9. Track bench resources + laptop reminders
    """
    print(f"\n  ╔══════════════════════════════════════════════════════════╗")
    print(f"  ║    D4 INSIGHT - VCC AUTOMATION BOT                      ║")
    print(f"  ║    Polling every {interval_minutes} minutes                            ║")
    print(f"  ╚══════════════════════════════════════════════════════════╝")
    print(f"  Monitoring: {automation_module.SENDER_EMAIL}")
    print(f"  Modules: Hiring | Leaves | Timesheets")
    print(f"  Press Ctrl+C to stop.\n")

    cycle = 0
    while True:
        cycle += 1
        now = datetime.now().strftime("%H:%M:%S")
        print(f"\n  ── Cycle {cycle} [{now}] ──────────────────────────────")

        try:
            # Step 1: Scan for new requirement emails
            print("  [1/4] Scanning for new requirements...")
            new_reqs = scan_requirement_emails(automation_module)

            # Step 2-5: For each new requirement, run full pipeline
            for req in new_reqs:
                print(f"\n  >>> New requirement detected: {req['title']}")

                # Send acknowledgment
                print("  [ACK] Sending acknowledgment to sender...")
                _send_ack_email(req, automation_module)

                # Auto-generate JD
                print("  [JD] Auto-generating Job Description...")
                _auto_generate_jd(req, automation_module)

            # Step 1b: Scan for leave requests
            print("  [2/6] Scanning for leave requests...")
            try:
                leave_results = automation_module.scan_leave_emails()
                if leave_results:
                    print(f"  >>> {len(leave_results)} new leave(s) recorded")
            except Exception as e:
                print(f"  Leave scan error: {e}")

            # Step 2b: Check for clarification replies (vague reqs that got answered)
            print("  [3/6] Checking clarification replies...")
            resolved_reqs = _check_for_clarification_replies(automation_module)
            for req in resolved_reqs:
                print(f"\n  >>> Clarification resolved: {req['title']} — running full pipeline")
                _send_ack_email(req, automation_module)
                _auto_generate_jd(req, automation_module)

            # Step 4: Scan for profile submissions
            print("  [4/6] Scanning for candidate profiles...")
            new_profiles = scan_profile_emails(automation_module)

            for profile in new_profiles:
                print(f"  >>> New profile: {profile['candidate_name']} for {profile.get('position', 'N/A')}")

            # Step 5: Check for status update emails (interview/selection/rejection)
            print("  [5/6] Checking for status updates...")
            _check_for_status_update_emails(automation_module)

            # Step 6: Check bench resources
            print("  [6/7] Checking bench resources...")
            check_bench_resources(automation_module)

            # Step 7: Timesheet automation (schedule-based)
            ts_action = _get_timesheet_schedule_action()
            today = datetime.now()
            # Only run timesheet steps once per day (check if already ran today)
            ts_state_file = os.path.join(HIRING_DATA_DIR, "ts_last_run.json")
            ts_ran_today = False
            try:
                with open(ts_state_file) as f:
                    ts_state = json.load(f)
                ts_ran_today = ts_state.get("date") == today.strftime("%Y-%m-%d") and ts_state.get("action") == ts_action
            except:
                pass

            if ts_action != "monitor" and not ts_ran_today:
                print(f"  [7/7] Timesheet: {ts_action} (day {today.day})...")
                _run_timesheet_step(ts_action, automation_module)
                with open(ts_state_file, "w") as f:
                    json.dump({"date": today.strftime("%Y-%m-%d"), "action": ts_action}, f)
            elif ts_action == "monitor":
                print("  [7/7] Timesheet: monitoring for Anand's review reply...")
                _run_timesheet_step("monitor", automation_module)
            else:
                print(f"  [7/7] Timesheet: {ts_action} already ran today, skipping.")

            # Summary
            data = _load_hiring_data()
            open_reqs = len([r for r in data.get("requirements", []) if r["status"] == "open"])
            pending_reqs = len([r for r in data.get("requirements", []) if r["status"] == "pending_clarification"])
            total_profiles = len(data.get("profiles", []))
            print(f"\n  Status: {open_reqs} open reqs | {pending_reqs} pending | {total_profiles} profiles tracked")

        except KeyboardInterrupt:
            print("\n\n  Watch mode stopped.")
            break
        except Exception as e:
            print(f"  ERROR in watch cycle: {e}")

        # Wait for next cycle
        try:
            print(f"  Next scan in {interval_minutes} minutes...")
            time.sleep(interval_minutes * 60)
        except KeyboardInterrupt:
            print("\n\n  Watch mode stopped.")
            break


# ═══════════════════════════════════════════════════════════════
# MAIN ENTRY POINTS (called from timesheet_automation.py)
# ═══════════════════════════════════════════════════════════════

def run_hire_scan(automation_module):
    """Scan emails for both requirements and profiles."""
    new_reqs = scan_requirement_emails(automation_module)
    new_profiles = scan_profile_emails(automation_module)
    return new_reqs, new_profiles

def run_hire_jd(req_id, automation_module):
    """Generate JD for a specific requirement."""
    return generate_jd(req_id, automation_module)

def run_hire_profiles(automation_module):
    """Scan for new profile submissions."""
    return scan_profile_emails(automation_module)

def run_hire_status():
    """Show hiring pipeline status."""
    hiring_status()

def run_hire_onboard(candidate_name, automation_module):
    """Trigger onboarding for a candidate."""
    return send_onboarding_email(candidate_name, automation_module)

def run_hire_update(profile_id, new_status):
    """Update a profile's pipeline status."""
    return update_profile_status(profile_id, new_status)

def run_hire_bench(automation_module):
    """Check bench resources."""
    return check_bench_resources(automation_module)
