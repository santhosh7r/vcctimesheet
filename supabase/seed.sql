-- ============================================================
-- VCC Seed Data — Insert demo data into Supabase
-- Run after schema.sql
-- ============================================================

-- ── USERS ──
INSERT INTO users (id, name, role, designation, project, start_date, end_date, hourly_rate, is_active, email, phone) VALUES
('100070', 'Pothiraja A', 'employee', 'Employee', 'VCC - Enterprise Integration', '2025-01-10', '2026-12-31', 37, TRUE, 'pothiraja@d4insight.com', '+91-9876543210'),
('100459', 'Vivekanandan Jeevanantham', 'employee', 'Employee', 'VCC - IT Helpdesk Offshore', '2025-01-12', '2026-12-31', 33, TRUE, 'vivek@d4insight.com', '+91-9876543211'),
('100530', 'Mohammed Navazuddin', 'employee', 'Employee', 'VCC - Salesforce', '2025-11-01', '2026-12-31', 35, TRUE, 'navaz@d4insight.com', '+91-9876543212'),
('100637', 'K P Mohammed Arif', 'employee', 'Employee', 'VCC - QA QC', '2025-01-12', '2026-12-31', 33, TRUE, 'arif@d4insight.com', '+91-9876543213'),
('111103', 'Nishandhini Ashok Kumar', 'employee', 'Employee', 'VCC - Salesforce', '2025-01-10', '2026-12-31', 33, TRUE, 'nishandhini@d4insight.com', '+91-9876543214'),
('100464', 'Balaji Padmanaban', 'employee', 'Employee', 'VCC - Partner Insight', '2025-01-12', '2026-12-31', 33, TRUE, 'balaji@d4insight.com', '+91-9876543215'),
('100617', 'Vimal David', 'employee', 'Employee', 'VCC - Web B2B', '2025-01-10', '2026-12-31', 39, TRUE, 'vimal@d4insight.com', '+91-9876543216'),
('100611', 'Sathishraj Rajendran', 'employee', 'Employee', 'VCC - Web B2B', '2025-01-10', '2026-12-31', 39, TRUE, 'sathish@d4insight.com', '+91-9876543217'),
('100616', 'Jagadeesh Raju', 'employee', 'Employee', 'VCC - Web B2B', '2026-03-30', '2026-12-31', 39, TRUE, 'jagadeesh@d4insight.com', '+91-9876543218'),
('111104', 'Divya Priya', 'employee', 'Employee', 'VCC - Salesforce', '2025-11-01', '2026-12-31', 35, TRUE, 'divya@d4insight.com', '+91-9876543219'),
('100659', 'Bholeshankar Pandey', 'employee', 'Employee', 'VCC - JDE & EDI', '2025-01-12', '2026-12-31', 37, TRUE, 'bhole@d4insight.com', '+91-9876543220'),
('100510', 'Kishore', 'manager', 'Manager', 'VCC - Partner Insight', '2026-03-09', '2026-12-31', 50, TRUE, 'kishore@d4insight.com', '+91-9876543221'),
('20241001001', 'Dhiraj Gurang', 'employee', 'Employee', 'VCC - IT Support Savannah', '2025-01-10', '2026-12-31', 40, TRUE, 'dhiraj@d4insight.com', '+1-5551234567'),
('20260201001', 'Andrea Solorzano', 'employee', 'Employee', 'VCC - D365 FO', '2025-01-10', '2026-12-31', 38, TRUE, 'andrea@d4insight.com', '+1-5551234568'),
('100678', 'Ashwath Soosainathan P', 'employee', 'Employee', 'VCC - QA QC', '2025-01-10', '2026-12-31', 33, TRUE, 'ashwath@d4insight.com', '+91-9876543222'),
('100048', 'Krupa Pankaj Vyas', 'employee', 'Employee', 'VCC - D365 FO', '2025-01-10', '2026-12-31', 35, TRUE, 'krupa.vyas@d4insight.com', '+91-9876543223'),
('ADM001', 'Kishore', 'admin', 'Admin', NULL, '2023-01-01', NULL, 0, TRUE, 'kishore@d4insight.com', '+91-9876543200')
ON CONFLICT (id) DO NOTHING;

-- ── LEAVE BALANCES ──
INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days)
SELECT u.id || '_casual', u.id, 'casual', 2026, 12, FLOOR(RANDOM() * 5)::int
FROM users u WHERE u.role = 'employee'
ON CONFLICT (id) DO NOTHING;

INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days)
SELECT u.id || '_sick', u.id, 'sick', 2026, 10, FLOOR(RANDOM() * 3)::int
FROM users u WHERE u.role = 'employee'
ON CONFLICT (id) DO NOTHING;

INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days)
SELECT u.id || '_earned', u.id, 'earned', 2026, 15, FLOOR(RANDOM() * 4)::int
FROM users u WHERE u.role = 'employee'
ON CONFLICT (id) DO NOTHING;

-- ── LEAVES ──
INSERT INTO leaves (id, user_id, user_name, leave_type, start_date, end_date, days_count, reason, status, approved_by, approved_at, created_at) VALUES
(1, '100070', 'Pothiraja A', 'casual', '2026-04-10', '2026-04-11', 2, 'Family function', 'approved', '100510', '2026-04-08', '2026-04-05'),
(2, '100459', 'Vivekanandan Jeevanantham', 'sick', '2026-04-14', '2026-04-14', 1, 'Fever', 'approved', '100510', '2026-04-13', '2026-04-13'),
(3, '100530', 'Mohammed Navazuddin', 'earned', '2026-04-28', '2026-04-30', 3, 'Vacation trip', 'pending', NULL, NULL, '2026-04-20'),
(4, '111103', 'Nishandhini Ashok Kumar', 'casual', '2026-04-21', '2026-04-21', 1, 'Personal work', 'approved', '100510', '2026-04-19', '2026-04-18'),
(5, '100617', 'Vimal David', 'wfh', '2026-04-22', '2026-04-22', 1, 'Internet setup at new home', 'pending', NULL, NULL, '2026-04-20'),
(6, '100637', 'K P Mohammed Arif', 'sick', '2026-03-25', '2026-03-26', 2, 'Medical appointment', 'approved', '100510', '2026-03-24', '2026-03-23'),
(7, '100464', 'Balaji Padmanaban', 'casual', '2026-05-01', '2026-05-02', 2, 'Family event', 'pending', NULL, NULL, '2026-04-22'),
(8, '100659', 'Bholeshankar Pandey', 'earned', '2026-03-10', '2026-03-12', 3, 'Travel', 'rejected', '100510', '2026-03-08', '2026-03-05')
ON CONFLICT (id) DO NOTHING;

SELECT setval('leaves_id_seq', 100);

-- ── FROZEN PERIODS ──
INSERT INTO frozen_periods (id, period_label, project, frozen_at) VALUES
(1, 'Mar 1 - Mar 15, 2026', NULL, '2026-03-20'),
(2, 'Mar 16 - Mar 31, 2026', NULL, '2026-04-05')
ON CONFLICT (id) DO NOTHING;

-- ── REQUIREMENTS ──
INSERT INTO requirements (id, title, description, project, location_type, location_detail, positions_count, skills, priority, status, created_by, created_at, updated_at) VALUES
(1, 'Senior Salesforce Developer', 'Need an experienced Salesforce developer with Lightning Web Components expertise.', 'VCC - Salesforce', 'offshore', 'Chennai, India', 2, 'Salesforce, Apex, LWC, SOQL', 'high', 'open', 'ADM001', '2026-03-15', '2026-03-15'),
(2, 'QA Automation Engineer', 'Selenium and Cypress automation testing engineer needed.', 'VCC - QA QC', 'offshore', 'Bangalore, India', 1, 'Selenium, Cypress, JavaScript, TestNG', 'medium', 'open', 'ADM001', '2026-03-20', '2026-03-20'),
(3, 'Full Stack Developer', 'React + Node.js developer for B2B web platform.', 'VCC - Web B2B', 'hybrid', 'Savannah, GA / Remote', 1, 'React, Node.js, PostgreSQL, AWS', 'urgent', 'open', 'ADM001', '2026-04-01', '2026-04-01'),
(4, 'D365 Functional Consultant', 'Finance and Operations module consultant.', 'VCC - D365 FO', 'onsite', 'Savannah, GA', 1, 'D365 FO, Finance Module, X++', 'medium', 'closed', 'ADM001', '2026-02-10', '2026-03-30'),
(5, 'IT Helpdesk Technician', 'L1/L2 support technician for offshore helpdesk.', 'VCC - IT Helpdesk Offshore', 'offshore', 'Chennai, India', 3, 'Windows, Active Directory, ServiceNow, Networking', 'medium', 'open', 'ADM001', '2026-04-10', '2026-04-10')
ON CONFLICT (id) DO NOTHING;

SELECT setval('requirements_id_seq', 100);

-- ── MEETINGS ──
INSERT INTO meetings (id, title, date, time, attendees, notes, project, created_by, created_by_name, created_at, updated_at) VALUES
(1, 'Sprint Planning - Web B2B', '2026-04-21', '10:00', '["100617", "100611", "100616"]', 'Discussed upcoming sprint goals. Prioritized the checkout flow redesign and API performance improvements.', 'VCC - Web B2B', '100510', 'Kishore', '2026-04-21', '2026-04-21'),
(2, 'Salesforce Integration Review', '2026-04-18', '14:30', '["100530", "111103", "111104"]', 'Reviewed the new CPQ integration. Found 3 blocking issues that need resolution before UAT.', 'VCC - Salesforce', '100510', 'Kishore', '2026-04-18', '2026-04-18'),
(3, 'Weekly Standup - QA Team', '2026-04-22', '09:30', '["100637", "100678"]', 'Discussed test coverage goals for Q2. Agreed to increase automation coverage to 70%.', 'VCC - QA QC', '100510', 'Kishore', '2026-04-22', '2026-04-22'),
(4, 'Client Demo Preparation', '2026-04-23', '11:00', '["100070", "100464"]', 'Prepared demo environment. Need to fix data seeding script before Thursday demo.', 'VCC - Enterprise Integration', '100510', 'Kishore', '2026-04-23', '2026-04-23')
ON CONFLICT (id) DO NOTHING;

SELECT setval('meetings_id_seq', 100);

-- ── MEETING ACTIONS ──
INSERT INTO meeting_actions (id, meeting_id, description, assigned_to, assigned_to_name, due_date, status, completed_at, created_at) VALUES
(1, 1, 'Complete checkout flow wireframes', '100617', 'Vimal David', '2026-04-25', 'in_progress', NULL, '2026-04-21'),
(2, 1, 'Setup performance benchmarks', '100611', 'Sathishraj Rajendran', '2026-04-28', 'open', NULL, '2026-04-21'),
(3, 2, 'Fix CPQ pricing calculation bug', '100530', 'Mohammed Navazuddin', '2026-04-22', 'completed', '2026-04-21', '2026-04-18'),
(4, 2, 'Update integration test suite', '111103', 'Nishandhini Ashok Kumar', '2026-04-24', 'open', NULL, '2026-04-18'),
(5, 3, 'Add Cypress tests for login module', '100637', 'K P Mohammed Arif', '2026-04-29', 'open', NULL, '2026-04-22')
ON CONFLICT (id) DO NOTHING;

SELECT setval('meeting_actions_id_seq', 100);

-- ── SALES DEALS ──
INSERT INTO sales_deals (id, title, client_name, deal_value, currency, stage, probability, expected_close_date, owner_id, notes, created_at, updated_at) VALUES
(1, 'Enterprise CRM Implementation', 'Acme Corp', 150000, 'USD', 'proposal', 60, '2026-06-30', 'ADM001', 'Large enterprise deal. Client comparing us with 2 other vendors.', '2026-02-15', '2026-04-10'),
(2, 'IT Support Services - Annual', 'TechFlow Inc', 85000, 'USD', 'negotiation', 75, '2026-05-15', 'ADM001', 'Renewal deal. Client happy with current service.', '2026-03-01', '2026-04-18'),
(3, 'Salesforce Migration', 'Global Retail Co', 220000, 'USD', 'qualified', 40, '2026-08-31', 'ADM001', 'Migrating from legacy CRM to Salesforce.', '2026-03-20', '2026-04-05'),
(4, 'Web Portal Development', 'StartUp Labs', 65000, 'USD', 'closed_won', 100, '2026-03-31', 'ADM001', 'Deal closed! Project starts May 2026.', '2026-01-10', '2026-03-28'),
(5, 'D365 Implementation Phase 2', 'Manufacturing Plus', 180000, 'USD', 'prospect', 20, '2026-09-30', 'ADM001', 'Follow-up from Phase 1. Client exploring budget.', '2026-04-01', '2026-04-15'),
(6, 'QA Outsourcing Contract', 'FinServ Group', 120000, 'USD', 'closed_lost', 0, '2026-04-15', 'ADM001', 'Lost to competitor on pricing.', '2026-02-01', '2026-04-15')
ON CONFLICT (id) DO NOTHING;

SELECT setval('sales_deals_id_seq', 100);

-- ── NINEBOX PLACEMENTS ──
INSERT INTO ninebox_placements (id, user_id, user_name, hourly_rate, project, potential, performance, period, notes, placed_by, placed_at) VALUES
(1, '100070', 'Pothiraja A', 37, 'VCC - Enterprise Integration', 'high', 'high', 'Q1 2026', 'Top performer. Ready for leadership role.', 'ADM001', '2026-04-01'),
(2, '100617', 'Vimal David', 39, 'VCC - Web B2B', 'high', 'medium', 'Q1 2026', 'High potential, needs more challenging projects.', 'ADM001', '2026-04-01'),
(3, '100530', 'Mohammed Navazuddin', 35, 'VCC - Salesforce', 'medium', 'high', 'Q1 2026', 'Consistent performer. Strong technical skills.', 'ADM001', '2026-04-01'),
(4, '100637', 'K P Mohammed Arif', 33, 'VCC - QA QC', 'medium', 'medium', 'Q1 2026', 'Steady contributor. Consider training opportunities.', 'ADM001', '2026-04-01'),
(5, '100459', 'Vivekanandan Jeevanantham', 33, 'VCC - IT Helpdesk Offshore', 'low', 'high', 'Q1 2026', 'Reliable in current role. Good domain expertise.', 'ADM001', '2026-04-01'),
(6, '111103', 'Nishandhini Ashok Kumar', 33, 'VCC - Salesforce', 'high', 'medium', 'Q1 2026', 'Fast learner. Mentorship recommended.', 'ADM001', '2026-04-01'),
(7, '100464', 'Balaji Padmanaban', 33, 'VCC - Partner Insight', 'medium', 'low', 'Q1 2026', 'Needs performance improvement plan.', 'ADM001', '2026-04-01')
ON CONFLICT (id) DO NOTHING;

SELECT setval('ninebox_placements_id_seq', 100);

-- ── DEFAULT SOP TEMPLATE ──
INSERT INTO sop_templates (id, name, description, html_content, variables, is_active, created_by) VALUES
(1, 'Standard Onboarding SOP', 'Default SOP template for new employee onboarding',
'<html>
<head><style>
body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
h2 { color: #2c5282; margin-top: 30px; }
.header { text-align: center; margin-bottom: 40px; }
.field { margin: 10px 0; }
.field label { font-weight: bold; color: #555; }
.section { margin: 20px 0; padding: 15px; background: #f7fafc; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; }
th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
th { background: #edf2f7; font-weight: bold; }
.signature { margin-top: 60px; }
.signature-line { border-top: 1px solid #333; width: 250px; margin-top: 40px; padding-top: 5px; }
</style></head>
<body>
<div class="header">
<h1>Statement of Procedures (SOP)</h1>
<p><strong>D4 Insight</strong></p>
</div>

<div class="section">
<h2>Employee Details</h2>
<table>
<tr><th>Employee Name</th><td>{{employee_name}}</td></tr>
<tr><th>Employee ID</th><td>{{employee_id}}</td></tr>
<tr><th>Email</th><td>{{employee_email}}</td></tr>
<tr><th>Project</th><td>{{project}}</td></tr>
<tr><th>Role</th><td>{{role}}</td></tr>
<tr><th>Start Date</th><td>{{start_date}}</td></tr>
<tr><th>End Date</th><td>{{end_date}}</td></tr>
<tr><th>Hourly Rate</th><td>${{hourly_rate}}/hr</td></tr>
</table>
</div>

<div class="section">
<h2>Scope of Work</h2>
<p>The employee shall perform duties as assigned under the {{project}} project, reporting to their designated manager. Work hours and deliverables will be tracked via the VCC Timesheet system.</p>
</div>

<div class="section">
<h2>Terms & Conditions</h2>
<ol>
<li>Employee must submit timesheets bi-monthly (1st-15th and 16th-end of month)</li>
<li>All work must be performed in accordance with client and VCC quality standards</li>
<li>Confidentiality agreements must be adhered to at all times</li>
<li>Leave requests must be submitted at least 48 hours in advance</li>
</ol>
</div>

<div class="signature">
<p><strong>Approved by:</strong></p>
<div class="signature-line">Client Signature / Date</div>
<br/>
<div class="signature-line">VCC Representative / Date</div>
</div>
</body>
</html>',
'["employee_name", "employee_id", "employee_email", "project", "role", "start_date", "end_date", "hourly_rate"]',
TRUE, 'ADM001')
ON CONFLICT (id) DO NOTHING;

SELECT setval('sop_templates_id_seq', 100);

-- ── DEFAULT SHAREPOINT FIELD MAPPING ──
INSERT INTO sharepoint_field_mapping (sharepoint_field, local_field, transform, is_active) VALUES
('EmployeeId', 'user_id', NULL, TRUE),
('EmployeeName', 'user_name', NULL, TRUE),
('Date', 'date', 'date', TRUE),
('Hours', 'hours', 'number', TRUE),
('WorkItem', 'work_item', NULL, TRUE),
('Description', 'description', NULL, TRUE),
('Project', 'user_project', NULL, TRUE);

-- ── DEFAULT INTEGRATION CONFIG ──
INSERT INTO integration_config (provider, config, is_active) VALUES
('microsoft365', '{"tenant_id": "", "client_id": "", "client_secret": "", "sharepoint_site_id": "", "sharepoint_list_id": "", "teams_enabled": false, "email_enabled": false}', FALSE),
('sharepoint', '{"sync_interval_minutes": 15, "business_hours_only": true, "business_start": 8, "business_end": 18}', TRUE)
ON CONFLICT (provider) DO NOTHING;
