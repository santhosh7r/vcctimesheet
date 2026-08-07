"""Generate VCC Platform Technical Architecture PDF"""
from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, 'VCC Workforce Management Platform - Technical Architecture', align='R')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Confidential | Page {self.page_no()}', align='C')

    def section_title(self, title):
        self.set_font('Helvetica', 'B', 14)
        self.set_text_color(20, 60, 120)
        self.ln(4)
        self.cell(0, 10, title)
        self.ln(10)
        self.set_draw_color(20, 60, 120)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def sub_title(self, title):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(40, 40, 40)
        self.ln(2)
        self.cell(0, 8, title)
        self.ln(8)

    def body_text(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def code_block(self, text):
        self.set_font('Courier', '', 8)
        self.set_fill_color(240, 240, 245)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        y = self.get_y()
        lines = text.split('\n')
        block_height = len(lines) * 4.2 + 4
        if y + block_height > 270:
            self.add_page()
        self.rect(10, self.get_y(), 190, block_height, 'F')
        self.ln(2)
        for line in lines:
            self.cell(0, 4.2, '  ' + line)
            self.ln(4.2)
        self.ln(3)

    def table_row(self, cells, widths, bold=False, header=False):
        self.set_font('Helvetica', 'B' if bold or header else '', 9)
        if header:
            self.set_fill_color(20, 60, 120)
            self.set_text_color(255, 255, 255)
        else:
            self.set_fill_color(248, 248, 252)
            self.set_text_color(30, 30, 30)

        row_h = 7
        for i, (cell, w) in enumerate(zip(cells, widths)):
            self.cell(w, row_h, str(cell), border=1, fill=header, align='L')
        self.ln(row_h)


pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# Title page
pdf.ln(30)
pdf.set_font('Helvetica', 'B', 26)
pdf.set_text_color(20, 60, 120)
pdf.cell(0, 15, 'VCC Workforce Management', align='C')
pdf.ln(14)
pdf.cell(0, 15, 'Platform', align='C')
pdf.ln(20)
pdf.set_font('Helvetica', '', 16)
pdf.set_text_color(80, 80, 80)
pdf.cell(0, 10, 'Technical Architecture & Development Pipeline', align='C')
pdf.ln(20)
pdf.set_font('Helvetica', '', 11)
pdf.cell(0, 8, 'Prepared for: D4 Insight', align='C')
pdf.ln(8)
pdf.cell(0, 8, 'Version: 1.0 | April 2026', align='C')
pdf.ln(8)
pdf.cell(0, 8, 'Classification: Confidential', align='C')

# Page 2 - Overview
pdf.add_page()
pdf.section_title('1. System Overview')
pdf.body_text(
    'The VCC Workforce Management Platform is an internal tool for timesheet consolidation, '
    'leave management, and resource tracking across D4 Insight\'s Visual Comfort & Co. engagement. '
    'The platform consists of a custom-built web dashboard integrated with Qoppy API for intelligent '
    'automation and Microsoft 365 for communication.'
)
pdf.body_text(
    'The system handles 61+ resources across 9 project groups, automating a fortnightly cycle of '
    'timesheet submission, validation, consolidation, review, and client delivery.'
)

# Architecture
pdf.section_title('2. High-Level Architecture')
pdf.code_block(
    'CLIENT LAYER (Browser)\n'
    '    React 19 SPA + TailwindCSS + Vite 8\n'
    '    Role-based views: Employee / Manager / Consolidator\n'
    '             |\n'
    '             v  HTTPS REST\n'
    'APPLICATION LAYER\n'
    '    Node.js / Express 5 API Server\n'
    '    Routes: /auth, /timesheets, /leaves, /users, /reports\n'
    '    Middleware: JWT verify, role guard, rate limiter\n'
    '             |\n'
    '    +--------+--------+------------------+\n'
    '    |                 |                  |\n'
    '    v                 v                  v\n'
    'DATA LAYER       QOPPY API         MICROSOFT 365\n'
    'Supabase         Automation         Graph API\n'
    'PostgreSQL       AI/NLP Engine      Outlook, Teams\n'
    'RLS enabled      Self-hosted LLM    Azure AD\n'
)

# Tech Stack
pdf.section_title('3. Tech Stack')
widths = [45, 55, 90]
pdf.table_row(['Category', 'Technology', 'Purpose'], widths, header=True)
rows = [
    ['Frontend', 'React 19, Vite 8, TailwindCSS 4', 'Single-page dashboard application'],
    ['UI Components', 'Framer Motion, Lucide Icons', 'Animations, iconography'],
    ['Backend', 'Node.js, Express 5', 'REST API server, routing'],
    ['Auth', 'JWT (jsonwebtoken)', 'Token-based role authentication'],
    ['Database', 'PostgreSQL (Supabase)', 'Cloud DB with Row Level Security'],
    ['DB Fallback', 'SQLite (better-sqlite3)', 'Offline/local development'],
    ['Automation', 'Qoppy API', 'Consolidation, AI review, leave detection'],
    ['AI/NLP', 'Qwen LLM (self-hosted)', 'Email parsing, natural language actions'],
    ['Communication', 'Microsoft Graph API', 'Email send/read, Teams, directory'],
    ['File Generation', 'OpenPyXL, xlsx.js', 'Excel report generation'],
    ['Hosting', 'Private VPS (Ubuntu)', 'Nginx, PM2, systemd services'],
    ['Version Control', 'Git', 'Source code management'],
]
for r in rows:
    pdf.table_row(r, widths)

# Development Pipeline
pdf.add_page()
pdf.section_title('4. Development Pipeline')
pdf.code_block(
    'CODE  -->  BUILD  -->  TEST  -->  STAGING  -->  PRODUCTION\n'
    '  |          |          |           |              |\n'
    'VSCode    Vite 8     Local Dev    VPS           VPS\n'
    'Git       ESLint     Mock API     Preview       Live\n'
    'Branch    Bundle     Qoppy API    Staging DB    Prod DB\n'
    '                     Sandbox\n'
    '\n'
    'Branching: feature branch -> review -> main -> staging -> prod'
)

# Qoppy Integration
pdf.section_title('5. Qoppy API Integration')
pdf.body_text(
    'Qoppy provides the intelligent automation layer via REST API. The platform consumes '
    'Qoppy endpoints for tasks that require AI processing, scheduled automation, and '
    'multi-channel notification orchestration.'
)
pdf.ln(2)
pdf.sub_title('API Endpoints Consumed')
widths2 = [55, 135]
pdf.table_row(['Endpoint', 'Function'], widths2, header=True)
api_rows = [
    ['/qoppy/v1/consolidate', 'Raw timesheet data -> formatted Excel per project group with summary + per-person breakdown'],
    ['/qoppy/v1/ai-review', 'Reviewer email body -> parsed action items (edits, verifications, removals) as JSON'],
    ['/qoppy/v1/leave-detect', 'Email content -> detected leave dates, resource name, leave type as structured record'],
    ['/qoppy/v1/notify', 'Multi-channel notifications (email + Teams). Handles retries, rate limiting, delivery status'],
    ['/qoppy/v1/validate', 'Cross-check timesheet vs leaves, flag anomalies, detect duplicates, enforce business rules'],
]
for r in api_rows:
    pdf.table_row(r, widths2)

pdf.ln(4)
pdf.body_text(
    'AI Model: Qoppy runs a self-hosted Qwen large language model. No data is sent to '
    'OpenAI, Google, or any external AI provider. All inference happens within Qoppy\'s '
    'private infrastructure.'
)

# Data Flow
pdf.add_page()
pdf.section_title('6. Data Flow - Fortnightly Timesheet Cycle')
pdf.code_block(
    'Day 1-14:  Employees fill timesheets via dashboard\n'
    '                    |\n'
    'Day 14:    Completion check (platform queries DB)\n'
    '           Missing? -> Qoppy /notify -> Teams + Email reminder\n'
    '                    |\n'
    'Day 15:    Consolidator triggers generation\n'
    '           Platform calls Qoppy /consolidate\n'
    '           -> 9 project Excel files + 1 master consolidated\n'
    '           -> Saved to DB + file storage\n'
    '                    |\n'
    'Day 15:    Send to reviewer via M365 Graph API\n'
    '                    |\n'
    'Day 15-16: Reviewer replies with feedback (free text)\n'
    '           Platform detects reply -> Qoppy /ai-review\n'
    '           -> AI parses: "check with X about date Y"\n'
    '           -> Qoppy /notify -> verification email + Teams\n'
    '                    |\n'
    'Day 16-17: Resource replies -> Qoppy /validate -> edits applied\n'
    '           -> Regenerate -> resend updated file\n'
    '                    |\n'
    'Day 17:    Approved -> send to clients per project\n'
    '           Platform sends via M365 Graph API\n'
    '                    |\n'
    'Day 17+:   Finance proceeds with invoicing'
)

# Leave Tracking
pdf.section_title('7. Leave Tracking Pipeline')
pdf.code_block(
    'Employee sends leave email\n'
    '  -> CC: leave-tracker@d4insight.com\n'
    '            |\n'
    'Platform scans mailbox (Graph API)\n'
    '            |\n'
    'Calls Qoppy /leave-detect\n'
    '  -> parses dates, resource, leave type\n'
    '            |\n'
    'Record inserted into Supabase (leaves table)\n'
    'Dashboard auto-updates in real-time\n'
    '            |\n'
    'Leave balance decremented automatically\n'
    '            |\n'
    'Threshold check:\n'
    '  3+ days -> Qoppy /notify -> manager warning email\n'
    '  5+ days -> Qoppy /notify -> manager + senior escalation\n'
    '            |\n'
    'Next timesheet generation:\n'
    '  Auto-deducts 8h per leave day from resource total\n'
    '  Reflected in Excel output automatically'
)

# Security
pdf.add_page()
pdf.section_title('8. Security Architecture')
widths3 = [45, 145]
pdf.table_row(['Layer', 'Control'], widths3, header=True)
sec_rows = [
    ['Network', 'HTTPS only (TLS 1.3). No open ports except 443. Nginx reverse proxy.'],
    ['Authentication', 'JWT tokens with expiry. Role-based access control (Employee/Manager/Consolidator).'],
    ['Database', 'Supabase Row Level Security - users can only query their own data rows.'],
    ['Qoppy API', 'API key auth + request signing. Data encrypted in transit (TLS). No data retention by Qoppy.'],
    ['M365 Integration', 'OAuth2 client_credentials. Tenant-scoped (D4 only). Customer owns Azure AD app.'],
    ['AI Processing', 'Self-hosted Qwen model within Qoppy. No data sent to any external AI service.'],
    ['File Storage', 'Excel outputs encrypted at rest (AES-256). Access via authenticated API only.'],
    ['Audit Logging', 'All state changes logged: who, when, action, source IP, outcome.'],
    ['Access Control', 'SSH key-only server access. Fail2ban. UFW firewall. VPN for admin.'],
    ['Backups', 'Automated daily database backups. Encrypted offsite storage.'],
]
for r in sec_rows:
    pdf.table_row(r, widths3)

# M365 Permissions
pdf.ln(6)
pdf.section_title('9. Microsoft 365 Permissions Required')
pdf.body_text(
    'The Azure AD app registration is owned and controlled by D4 Insight. '
    'The platform connects using credentials D4 provides. D4 can revoke all access at any time via Azure Portal.'
)
pdf.ln(2)
widths4 = [45, 30, 115]
pdf.table_row(['Permission', 'Type', 'Purpose'], widths4, header=True)
perm_rows = [
    ['Mail.Send', 'Application', 'Send timesheet/notification emails from consolidator account'],
    ['Mail.Read', 'Application', 'Read reviewer replies for AI processing'],
    ['User.Read.All', 'Application', 'Look up employee display names and email addresses'],
    ['Chat.ReadWrite.All', 'Application', 'Send Teams verification messages to resources'],
    ['Sites.Read.All', 'Application', 'Read SharePoint timesheet source data (if applicable)'],
]
for r in perm_rows:
    pdf.table_row(r, widths4)

# Infrastructure
pdf.add_page()
pdf.section_title('10. Infrastructure')
widths5 = [40, 60, 90]
pdf.table_row(['Environment', 'Stack', 'Purpose'], widths5, header=True)
infra_rows = [
    ['Development', 'Local + SQLite + Vite dev', 'Feature development, unit testing'],
    ['Testing', 'VPS + Supabase test + Qoppy sandbox', 'Integration testing, email/Teams test mode'],
    ['Production', 'VPS + Supabase prod + Qoppy prod', 'Live deployment for all users'],
]
for r in infra_rows:
    pdf.table_row(r, widths5)

pdf.ln(6)
pdf.sub_title('VPS Specification')
pdf.body_text(
    '- OS: Ubuntu 22.04 LTS\n'
    '- CPU: 4 vCPU\n'
    '- RAM: 8 GB\n'
    '- Storage: 100 GB SSD (encrypted)\n'
    '- Web Server: Nginx (reverse proxy + SSL via Let\'s Encrypt)\n'
    '- Process Manager: PM2 (Node.js), systemd (Python workers)\n'
    '- Firewall: UFW (only port 443 open)\n'
    '- Security: SSH key-only, Fail2ban, automatic security patches\n'
    '- Backups: Daily automated to encrypted offsite storage'
)

# Data Privacy
pdf.section_title('11. Data Privacy & Controls')
pdf.body_text(
    'Key principles governing data handling within the platform:'
)
pdf.ln(2)
pdf.body_text(
    '1. Data Isolation: Each customer environment is fully isolated. D4 data is never '
    'co-mingled with any other organization\'s data.\n\n'
    '2. AI Privacy: The Qoppy AI engine uses a self-hosted Qwen model. No employee data, '
    'timesheet data, or email content is ever sent to OpenAI, Google, Microsoft Copilot, '
    'or any external AI service.\n\n'
    '3. Minimal Access: The platform requests only the minimum M365 permissions needed. '
    'No access to SharePoint documents, OneDrive files, or calendar data beyond what is '
    'explicitly listed.\n\n'
    '4. Customer Control: D4 Insight owns the Azure AD app registration. All credentials '
    'are D4-controlled. Access can be fully revoked in under 60 seconds from Azure Portal.\n\n'
    '5. No Data Export: Data processed by the platform stays within the platform ecosystem. '
    'No data is sold, shared, or used for model training.\n\n'
    '6. Retention: Timesheet and leave data retained per D4\'s policy. On contract termination, '
    'all data is permanently deleted within 30 days.'
)

# Save
output_path = r'D:\Velozity Global\VCC\timesheet-app\scripts\VCC_Technical_Architecture.pdf'
pdf.output(output_path)
print(f'PDF generated: {output_path}')
