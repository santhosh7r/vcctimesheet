-- ============================================================
-- VCC Timesheet App — demo data
--
-- GENERATED FILE. Do not edit by hand.
-- Regenerate with: node supabase/_build/build-seed.mjs
--
-- Run AFTER setup-all.sql. Safe to re-run: every insert is
-- ON CONFLICT DO NOTHING and sequences are reset at the end of
-- each section.
-- ============================================================

BEGIN;

-- ── People ──

-- users (19)
INSERT INTO users (id, name, role, designation, project, start_date, end_date, hourly_rate, is_active, email, phone) VALUES
  ('100070', 'Pothiraja A', 'employee', 'Employee', 'VCC - Enterprise Integration', '2025-01-10', '2026-12-31', 32, true, 'pothiraja@d4insight.com', '+91-9876543210'),
  ('100459', 'Vivekanandan Jeevanantham', 'employee', 'Employee', 'VCC - IT Helpdesk Offshore', '2025-01-12', '2026-12-31', 30, true, 'vivek@d4insight.com', '+91-9876543211'),
  ('100530', 'Mohammed Navazuddin', 'employee', 'Employee', 'VCC - Salesforce', '2025-11-01', '2026-12-31', 35, true, 'navaz@d4insight.com', '+91-9876543212'),
  ('100637', 'K P Mohammed Arif', 'employee', 'Employee', 'VCC - QA QC', '2025-01-12', '2026-12-31', 33, true, 'arif@d4insight.com', '+91-9876543213'),
  ('111103', 'Nishandhini Ashok Kumar', 'employee', 'Employee', 'VCC - Salesforce', '2025-01-10', '2026-12-31', 32, true, 'nishandhini@d4insight.com', '+91-9876543214'),
  ('100464', 'Balaji Padmanaban', 'employee', 'Employee', 'VCC - Partner Insight', '2025-01-12', '2026-12-31', 33, true, 'balaji@d4insight.com', '+91-9876543215'),
  ('100617', 'Vimal David', 'employee', 'Employee', 'VCC - Web B2B', '2025-01-10', '2026-12-31', 39, true, 'vimal@d4insight.com', '+91-9876543216'),
  ('100611', 'Sathishraj Rajendran', 'employee', 'Employee', 'VCC - Web B2B', '2025-01-10', '2026-12-31', 39, true, 'sathish@d4insight.com', '+91-9876543217'),
  ('100616', 'Jagadeesh Raju', 'employee', 'Employee', 'VCC - Web B2B', '2026-03-30', '2026-12-31', 39, true, 'jagadeesh@d4insight.com', '+91-9876543218'),
  ('111104', 'Divya Priya', 'employee', 'Employee', 'VCC - Salesforce', '2025-11-01', '2026-12-31', 35, true, 'divya@d4insight.com', '+91-9876543219'),
  ('100659', 'Bholeshankar Pandey', 'employee', 'Employee', 'VCC - JDE & EDI', '2025-01-12', '2026-12-31', 37, true, 'bhole@d4insight.com', '+91-9876543220'),
  ('100510', 'Kishore', 'manager', 'Manager', 'VCC - Partner Insight', '2026-03-09', '2026-12-31', 35, true, 'kishore@d4insight.com', '+91-9876543221'),
  ('20241001001', 'Dhiraj Gurang', 'employee', 'Employee', 'VCC - IT Support Savannah', '2025-01-10', '2026-12-31', 65, true, 'dhiraj@d4insight.com', '+1-5551234567'),
  ('20260201001', 'Andrea Solorzano', 'employee', 'Employee', 'VCC - D365 FO', '2025-01-10', '2026-12-31', 0, true, 'andrea@d4insight.com', '+1-5551234568'),
  ('100678', 'Ashwath Soosainathan P', 'employee', 'Employee', 'VCC - QA QC', '2025-01-10', '2026-12-31', 0, true, 'ashwath@d4insight.com', '+91-9876543222'),
  ('100048', 'Krupa Pankaj Vyas', 'employee', 'Employee', 'VCC - D365 FO', '2025-01-10', '2026-12-31', 38, true, 'krupa.vyas@d4insight.com', '+91-9876543223'),
  ('ADM001', 'Kishore', 'admin', 'Admin', NULL, '2023-01-01', NULL, 0, true, 'kishore@d4insight.com', '+91-9876543200'),
  ('ADM002', 'Gayathri Murugadas', 'admin', 'Admin', NULL, '2023-01-01', NULL, 0, true, 'gayathri.m@d4insight.com', '+91-9876543202'),
  ('FIN001', 'Finance Lead', 'finance', 'Finance', NULL, '2024-01-01', NULL, 0, true, 'finance@d4insight.com', '+91-9876543201')
ON CONFLICT (id) DO NOTHING;

-- Client-side logins for the Client Portal (vendor tool).
-- CLI001 = client finance, CLI002 = client manager (seeded in migration-023).
INSERT INTO users (id, name, role, client_id, client_subrole, is_active, email, start_date) VALUES
  ('CLI001', 'Client Finance', 'client', 'CLT001', 'finance', true, 'finance@visualcomfort.com', '2024-01-01')
ON CONFLICT (id) DO UPDATE
  SET role = 'client', client_id = 'CLT001', client_subrole = 'finance', is_active = true;

-- ── Billing reference data ──

-- clients (1)
INSERT INTO clients (id, name, region, contact_name, contact_email, status, notes, created_at) VALUES
  ('CLT001', 'Visual Comfort Company', 'USA', 'VCC Finance', 'finance@visualcomfort.com', 'active', 'Primary client — all VCC projects', '2024-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- billable_projects (16)
INSERT INTO billable_projects (id, name, client_id, billing_type, bill_rate, currency, status, notes, created_at) VALUES
  ('BP001', 'VCC - Salesforce', 'CLT001', 'hourly', 45, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP002', 'VCC - Web B2B', 'CLT001', 'hourly', 55, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP003', 'VCC - QA QC', 'CLT001', 'hourly', 50, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP004', 'VCC - JDE & EDI', 'CLT001', 'hourly', 48, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP005', 'VCC - Partner Insight', 'CLT001', 'hourly', 55, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP006', 'VCC - IT Helpdesk Offshore', 'CLT001', 'hourly', 38, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP007', 'VCC - Enterprise Integration', 'CLT001', 'hourly', 50, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP008', 'VCC - D365 FO', 'CLT001', 'hourly', 60, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP009', 'VCC - IT Support Savannah', 'CLT001', 'hourly', 60, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP010', 'VCC - IT Infra Onsite', 'CLT001', 'hourly', 65, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP011', 'VCC - IT Infra PMO', 'CLT001', 'hourly', 70, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP012', 'VCC - Projects PMO', 'CLT001', 'hourly', 65, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP013', 'VCC - Zendesk', 'CLT001', 'hourly', 42, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP014', 'VCC - BA - Onsite', 'CLT001', 'hourly', 75, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP015', 'VCC - Project Financial Services', 'CLT001', 'hourly', 80, 'USD', 'active', NULL, '2024-01-01T00:00:00Z'),
  ('BP016', 'VCC - IT Infra - 8x8', 'CLT001', 'hourly', 50, 'USD', 'active', NULL, '2024-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ── SOW workflow (one row at each lifecycle stage) ──

-- sows (4)
INSERT INTO sows (id, sow_number, client_id, project_id, title, sow_type, description, contract_value, currency, start_date, end_date, status, resource_name, resource_role, resource_rate, finance_approved_by, finance_approved_at, finance_notes, manager_signed_by, manager_signed_at, docusign_envelope_id, docusign_status, created_by, created_at, updated_at) VALUES
  (1, 'SOW-2026-0007', 'CLT001', 'BP005', 'Partner Insight – New Resource: Senior Consultant', 'resource', 'Adding 1 Senior Technical Consultant to the Partner Insight engagement to accelerate phase 2 delivery.', 124800, 'USD', '2026-06-01', '2026-12-31', 'submitted_for_finance', 'Arun Joseph Arulsekar', 'Senior Technical Consultant', 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ADM001', '2026-05-08T10:30:00Z', '2026-05-08T10:30:00Z'),
  (2, 'SOW-2026-0006', 'CLT001', 'BP002', 'Web B2B – Q3 Module Expansion', 'project', 'Build out the customer self-service portal as an additional module on Web B2B. 4-month engagement, 3 resources.', 248000, 'USD', '2026-07-01', '2026-10-31', 'sent_for_signature', NULL, NULL, NULL, 'CLI001', '2026-05-05T14:20:00Z', 'Approved — within budget.', NULL, NULL, 'DEMO-DS-7392-A1', 'sent', 'ADM001', '2026-04-28T09:00:00Z', '2026-05-05T14:20:00Z'),
  (3, 'SOW-2026-0005', 'CLT001', 'BP001', 'Salesforce – Integration Phase 3', 'project', 'Integration of Salesforce with NetSuite ERP. 6-month phase 3.', 380000, 'USD', '2026-04-01', '2026-09-30', 'active', NULL, NULL, NULL, 'CLI001', '2026-03-15T11:00:00Z', NULL, 'CLI002', '2026-03-22T16:45:00Z', 'DEMO-DS-7341-B2', 'completed', 'ADM001', '2026-03-10T08:00:00Z', '2026-03-22T16:45:00Z'),
  (4, 'SOW-2026-0004', 'CLT001', NULL, 'IT Helpdesk Offshore – Rate Card Amendment', 'amendment', 'Annual rate adjustment of +6% on the IT Helpdesk Offshore engagement.', 12000, 'USD', '2026-05-01', '2027-04-30', 'finance_approved', NULL, NULL, NULL, 'CLI001', '2026-05-09T13:10:00Z', 'CPI-aligned, OK.', NULL, NULL, NULL, NULL, 'FIN001', '2026-05-02T09:00:00Z', '2026-05-09T13:10:00Z')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('sows', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM sows), 1));

-- holidays (27)
INSERT INTO holidays (holiday_date, country, name) VALUES
  ('2026-01-01', 'IN', 'New Year''s Day'),
  ('2026-01-26', 'IN', 'Republic Day'),
  ('2026-03-06', 'IN', 'Holi'),
  ('2026-03-21', 'IN', 'Eid al-Fitr'),
  ('2026-04-03', 'IN', 'Good Friday'),
  ('2026-04-14', 'IN', 'Ambedkar Jayanti'),
  ('2026-05-01', 'IN', 'Labour Day'),
  ('2026-05-27', 'IN', 'Eid al-Adha'),
  ('2026-08-15', 'IN', 'Independence Day'),
  ('2026-08-26', 'IN', 'Janmashtami'),
  ('2026-10-02', 'IN', 'Gandhi Jayanti'),
  ('2026-10-20', 'IN', 'Dussehra'),
  ('2026-11-08', 'IN', 'Diwali'),
  ('2026-11-25', 'IN', 'Guru Nanak Jayanti'),
  ('2026-12-25', 'IN', 'Christmas Day'),
  ('2026-01-01', 'US', 'New Year''s Day'),
  ('2026-01-19', 'US', 'Martin Luther King Jr. Day'),
  ('2026-02-16', 'US', 'Presidents'' Day'),
  ('2026-05-25', 'US', 'Memorial Day'),
  ('2026-06-19', 'US', 'Juneteenth'),
  ('2026-07-03', 'US', 'Independence Day (observed)'),
  ('2026-09-07', 'US', 'Labor Day'),
  ('2026-10-12', 'US', 'Columbus Day'),
  ('2026-11-11', 'US', 'Veterans Day'),
  ('2026-11-26', 'US', 'Thanksgiving Day'),
  ('2026-11-27', 'US', 'Day after Thanksgiving'),
  ('2026-12-25', 'US', 'Christmas Day')
ON CONFLICT (holiday_date, country, name) DO NOTHING;

-- ── Leave ──

-- leave_balances (45)
INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days) VALUES
  ('100070_casual', '100070', 'casual', 2026, 12, 2),
  ('100070_sick', '100070', 'sick', 2026, 10, 1),
  ('100070_earned', '100070', 'earned', 2026, 15, 0),
  ('100459_casual', '100459', 'casual', 2026, 12, 3),
  ('100459_sick', '100459', 'sick', 2026, 10, 0),
  ('100459_earned', '100459', 'earned', 2026, 15, 0),
  ('100530_casual', '100530', 'casual', 2026, 12, 1),
  ('100530_sick', '100530', 'sick', 2026, 10, 1),
  ('100530_earned', '100530', 'earned', 2026, 15, 2),
  ('100637_casual', '100637', 'casual', 2026, 12, 4),
  ('100637_sick', '100637', 'sick', 2026, 10, 1),
  ('100637_earned', '100637', 'earned', 2026, 15, 0),
  ('111103_casual', '111103', 'casual', 2026, 12, 3),
  ('111103_sick', '111103', 'sick', 2026, 10, 2),
  ('111103_earned', '111103', 'earned', 2026, 15, 3),
  ('100464_casual', '100464', 'casual', 2026, 12, 4),
  ('100464_sick', '100464', 'sick', 2026, 10, 1),
  ('100464_earned', '100464', 'earned', 2026, 15, 0),
  ('100617_casual', '100617', 'casual', 2026, 12, 1),
  ('100617_sick', '100617', 'sick', 2026, 10, 2),
  ('100617_earned', '100617', 'earned', 2026, 15, 1),
  ('100611_casual', '100611', 'casual', 2026, 12, 0),
  ('100611_sick', '100611', 'sick', 2026, 10, 2),
  ('100611_earned', '100611', 'earned', 2026, 15, 0),
  ('100616_casual', '100616', 'casual', 2026, 12, 3),
  ('100616_sick', '100616', 'sick', 2026, 10, 2),
  ('100616_earned', '100616', 'earned', 2026, 15, 1),
  ('111104_casual', '111104', 'casual', 2026, 12, 4),
  ('111104_sick', '111104', 'sick', 2026, 10, 0),
  ('111104_earned', '111104', 'earned', 2026, 15, 3),
  ('100659_casual', '100659', 'casual', 2026, 12, 0),
  ('100659_sick', '100659', 'sick', 2026, 10, 2),
  ('100659_earned', '100659', 'earned', 2026, 15, 0),
  ('20241001001_casual', '20241001001', 'casual', 2026, 12, 3),
  ('20241001001_sick', '20241001001', 'sick', 2026, 10, 0),
  ('20241001001_earned', '20241001001', 'earned', 2026, 15, 3),
  ('20260201001_casual', '20260201001', 'casual', 2026, 12, 0),
  ('20260201001_sick', '20260201001', 'sick', 2026, 10, 2),
  ('20260201001_earned', '20260201001', 'earned', 2026, 15, 0),
  ('100678_casual', '100678', 'casual', 2026, 12, 2),
  ('100678_sick', '100678', 'sick', 2026, 10, 0),
  ('100678_earned', '100678', 'earned', 2026, 15, 3),
  ('100048_casual', '100048', 'casual', 2026, 12, 1),
  ('100048_sick', '100048', 'sick', 2026, 10, 1),
  ('100048_earned', '100048', 'earned', 2026, 15, 1)
ON CONFLICT (id) DO NOTHING;

-- leaves (8)
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
SELECT setval(pg_get_serial_sequence('leaves', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM leaves), 1));

-- ── Tasks ──

-- tasks (24)
INSERT INTO tasks (id, user_id, user_name, assigned_by, assigned_by_name, title, description, date, priority, status, estimated_hours, actual_hours, completed_at, created_at, updated_at) VALUES
  (1, '100070', 'Pothiraja A', '100510', 'Kishore', 'Review API documentation', 'Demo task description for testing purposes.', '2026-08-07', 'low', 'pending', 4, NULL, NULL, '2026-08-07', '2026-08-07'),
  (2, '100070', 'Pothiraja A', '100510', 'Kishore', 'Fix login bug on staging', 'Demo task description for testing purposes.', '2026-08-06', 'medium', 'in_progress', 6, NULL, NULL, '2026-08-06', '2026-08-06'),
  (3, '100070', 'Pothiraja A', '100510', 'Kishore', 'Update unit tests', 'Demo task description for testing purposes.', '2026-08-05', 'medium', 'completed', 8, 7, '2026-08-05', '2026-08-05', '2026-08-05'),
  (4, '100459', 'Vivekanandan Jeevanantham', '100510', 'Kishore', 'Deploy to UAT', 'Demo task description for testing purposes.', '2026-08-05', 'medium', 'in_progress', 4, NULL, NULL, '2026-08-05', '2026-08-05'),
  (5, '100459', 'Vivekanandan Jeevanantham', '100510', 'Kishore', 'Code review for PR #45', 'Demo task description for testing purposes.', '2026-08-04', 'medium', 'completed', 6, 5, '2026-08-04', '2026-08-04', '2026-08-04'),
  (6, '100459', 'Vivekanandan Jeevanantham', '100510', 'Kishore', 'Update Salesforce integration', 'Demo task description for testing purposes.', '2026-08-03', 'high', 'completed', 8, 7, '2026-08-03', '2026-08-03', '2026-08-03'),
  (7, '100530', 'Mohammed Navazuddin', '100510', 'Kishore', 'Database migration script', 'Demo task description for testing purposes.', '2026-08-03', 'medium', 'completed', 4, 3, '2026-08-03', '2026-08-03', '2026-08-03'),
  (8, '100530', 'Mohammed Navazuddin', '100510', 'Kishore', 'Write technical spec', 'Demo task description for testing purposes.', '2026-08-02', 'high', 'completed', 6, 5, '2026-08-02', '2026-08-02', '2026-08-02'),
  (9, '100530', 'Mohammed Navazuddin', '100510', 'Kishore', 'Performance optimization', 'Demo task description for testing purposes.', '2026-08-01', 'urgent', 'in_progress', 8, NULL, NULL, '2026-08-01', '2026-08-01'),
  (10, '100637', 'K P Mohammed Arif', '100510', 'Kishore', 'Setup CI/CD pipeline', 'Demo task description for testing purposes.', '2026-08-01', 'high', 'completed', 4, 3, '2026-08-01', '2026-08-01', '2026-08-01'),
  (11, '100637', 'K P Mohammed Arif', '100510', 'Kishore', 'Client demo preparation', 'Demo task description for testing purposes.', '2026-07-31', 'urgent', 'in_progress', 6, NULL, NULL, '2026-07-31', '2026-07-31'),
  (12, '100637', 'K P Mohammed Arif', '100510', 'Kishore', 'Bug triage meeting', 'Demo task description for testing purposes.', '2026-07-30', 'medium', 'pending', 8, NULL, NULL, '2026-07-30', '2026-07-30'),
  (13, '111103', 'Nishandhini Ashok Kumar', '100510', 'Kishore', 'Update dependency versions', 'Demo task description for testing purposes.', '2026-07-30', 'urgent', 'in_progress', 4, NULL, NULL, '2026-07-30', '2026-07-30'),
  (14, '111103', 'Nishandhini Ashok Kumar', '100510', 'Kishore', 'Create data backup script', 'Demo task description for testing purposes.', '2026-07-29', 'medium', 'pending', 6, NULL, NULL, '2026-07-29', '2026-07-29'),
  (15, '111103', 'Nishandhini Ashok Kumar', '100510', 'Kishore', 'Implement search feature', 'Demo task description for testing purposes.', '2026-07-28', 'high', 'completed', 8, 7, '2026-07-28', '2026-07-28', '2026-07-28'),
  (16, '100464', 'Balaji Padmanaban', '100510', 'Kishore', 'Review API documentation', 'Demo task description for testing purposes.', '2026-07-28', 'medium', 'pending', 4, NULL, NULL, '2026-07-28', '2026-07-28'),
  (17, '100464', 'Balaji Padmanaban', '100510', 'Kishore', 'Fix login bug on staging', 'Demo task description for testing purposes.', '2026-07-27', 'high', 'completed', 6, 5, '2026-07-27', '2026-07-27', '2026-07-27'),
  (18, '100464', 'Balaji Padmanaban', '100510', 'Kishore', 'Update unit tests', 'Demo task description for testing purposes.', '2026-07-26', 'low', 'pending', 8, NULL, NULL, '2026-07-26', '2026-07-26'),
  (19, '100617', 'Vimal David', '100510', 'Kishore', 'Deploy to UAT', 'Demo task description for testing purposes.', '2026-07-26', 'high', 'completed', 4, 3, '2026-07-26', '2026-07-26', '2026-07-26'),
  (20, '100617', 'Vimal David', '100510', 'Kishore', 'Code review for PR #45', 'Demo task description for testing purposes.', '2026-07-25', 'low', 'pending', 6, NULL, NULL, '2026-07-25', '2026-07-25'),
  (21, '100617', 'Vimal David', '100510', 'Kishore', 'Update Salesforce integration', 'Demo task description for testing purposes.', '2026-08-07', 'medium', 'in_progress', 8, NULL, NULL, '2026-08-07', '2026-08-07'),
  (22, '100611', 'Sathishraj Rajendran', '100510', 'Kishore', 'Database migration script', 'Demo task description for testing purposes.', '2026-08-07', 'low', 'pending', 4, NULL, NULL, '2026-08-07', '2026-08-07'),
  (23, '100611', 'Sathishraj Rajendran', '100510', 'Kishore', 'Write technical spec', 'Demo task description for testing purposes.', '2026-08-06', 'medium', 'in_progress', 6, NULL, NULL, '2026-08-06', '2026-08-06'),
  (24, '100611', 'Sathishraj Rajendran', '100510', 'Kishore', 'Performance optimization', 'Demo task description for testing purposes.', '2026-08-05', 'medium', 'completed', 8, 7, '2026-08-05', '2026-08-05', '2026-08-05')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('tasks', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM tasks), 1));

-- ── Documents (metadata only — no files in the bucket) ──

-- documents (6)
INSERT INTO documents (id, user_id, doc_type, original_name, stored_name, file_size, mime_type, uploaded_by, uploaded_at) VALUES
  (1, '100070', 'offer_letter', 'Offer_Letter_Pothiraja.pdf', 'doc_1.pdf', 245000, 'application/pdf', 'ADM001', '2025-02-15'),
  (2, '100070', 'sow', 'SOW_Enterprise_Integration.pdf', 'doc_2.pdf', 520000, 'application/pdf', 'ADM001', '2025-02-20'),
  (3, '100459', 'contract', 'Contract_Vivek.pdf', 'doc_3.pdf', 310000, 'application/pdf', 'ADM001', '2025-03-01'),
  (4, '100530', 'offer_letter', 'Offer_Navaz.pdf', 'doc_4.pdf', 198000, 'application/pdf', 'ADM001', '2025-11-05'),
  (5, '100617', 'sow', 'SOW_Web_B2B.pdf', 'doc_5.pdf', 450000, 'application/pdf', 'ADM001', '2025-01-15'),
  (6, '100510', 'contract', 'Contract_Kishore.pdf', 'doc_6.pdf', 280000, 'application/pdf', 'ADM001', '2026-03-15')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('documents', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM documents), 1));

-- ── Operations ──

-- frozen_periods (2)
INSERT INTO frozen_periods (id, period_label, project, frozen_at) VALUES
  (1, 'Mar 1 - Mar 15, 2026', NULL, '2026-03-20'),
  (2, 'Mar 16 - Mar 31, 2026', NULL, '2026-04-05')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('frozen_periods', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM frozen_periods), 1));

-- requirements (5)
INSERT INTO requirements (id, title, description, project, location_type, location_detail, positions_count, skills, priority, status, created_by, created_at, updated_at) VALUES
  (1, 'Senior Salesforce Developer', 'Need an experienced Salesforce developer with Lightning Web Components expertise.', 'VCC - Salesforce', 'offshore', 'Chennai, India', 2, 'Salesforce, Apex, LWC, SOQL', 'high', 'open', 'ADM001', '2026-03-15', '2026-03-15'),
  (2, 'QA Automation Engineer', 'Selenium and Cypress automation testing engineer needed.', 'VCC - QA QC', 'offshore', 'Bangalore, India', 1, 'Selenium, Cypress, JavaScript, TestNG', 'medium', 'open', 'ADM001', '2026-03-20', '2026-03-20'),
  (3, 'Full Stack Developer', 'React + Node.js developer for B2B web platform.', 'VCC - Web B2B', 'hybrid', 'Savannah, GA / Remote', 1, 'React, Node.js, PostgreSQL, AWS', 'urgent', 'open', 'ADM001', '2026-04-01', '2026-04-01'),
  (4, 'D365 Functional Consultant', 'Finance and Operations module consultant.', 'VCC - D365 FO', 'onsite', 'Savannah, GA', 1, 'D365 FO, Finance Module, X++', 'medium', 'closed', 'ADM001', '2026-02-10', '2026-03-30'),
  (5, 'IT Helpdesk Technician', 'L1/L2 support technician for offshore helpdesk.', 'VCC - IT Helpdesk Offshore', 'offshore', 'Chennai, India', 3, 'Windows, Active Directory, ServiceNow, Networking', 'medium', 'open', 'ADM001', '2026-04-10', '2026-04-10')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('requirements', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM requirements), 1));

-- meetings (4)
INSERT INTO meetings (id, title, date, time, attendees, notes, project, created_by, created_by_name, created_at, updated_at) VALUES
  (1, 'Sprint Planning - Web B2B', '2026-04-21', '10:00', '["100617","100611","100616"]'::jsonb, 'Discussed upcoming sprint goals. Prioritized the checkout flow redesign and API performance improvements.', 'VCC - Web B2B', '100510', 'Kishore', '2026-04-21', '2026-04-21'),
  (2, 'Salesforce Integration Review', '2026-04-18', '14:30', '["100530","111103","111104"]'::jsonb, 'Reviewed the new CPQ integration. Found 3 blocking issues that need resolution before UAT.', 'VCC - Salesforce', '100510', 'Kishore', '2026-04-18', '2026-04-18'),
  (3, 'Weekly Standup - QA Team', '2026-04-22', '09:30', '["100637","100678"]'::jsonb, 'Discussed test coverage goals for Q2. Agreed to increase automation coverage to 70%.', 'VCC - QA QC', '100510', 'Kishore', '2026-04-22', '2026-04-22'),
  (4, 'Client Demo Preparation', '2026-04-23', '11:00', '["100070","100464"]'::jsonb, 'Prepared demo environment. Need to fix data seeding script before Thursday demo.', 'VCC - Enterprise Integration', '100510', 'Kishore', '2026-04-23', '2026-04-23')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('meetings', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM meetings), 1));

-- meeting_actions (5)
INSERT INTO meeting_actions (id, meeting_id, description, assigned_to, assigned_to_name, due_date, status, completed_at, created_at) VALUES
  (1, 1, 'Complete checkout flow wireframes', '100617', 'Vimal David', '2026-04-25', 'in_progress', NULL, '2026-04-21'),
  (2, 1, 'Setup performance benchmarks', '100611', 'Sathishraj Rajendran', '2026-04-28', 'open', NULL, '2026-04-21'),
  (3, 2, 'Fix CPQ pricing calculation bug', '100530', 'Mohammed Navazuddin', '2026-04-22', 'completed', '2026-04-21', '2026-04-18'),
  (4, 2, 'Update integration test suite', '111103', 'Nishandhini Ashok Kumar', '2026-04-24', 'open', NULL, '2026-04-18'),
  (5, 3, 'Add Cypress tests for login module', '100637', 'K P Mohammed Arif', '2026-04-29', 'open', NULL, '2026-04-22')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('meeting_actions', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM meeting_actions), 1));

-- sales_deals (6)
INSERT INTO sales_deals (id, title, client_name, deal_value, currency, stage, probability, expected_close_date, owner_id, notes, created_at, updated_at) VALUES
  (1, 'Enterprise CRM Implementation', 'Acme Corp', 150000, 'USD', 'proposal', 60, '2026-06-30', 'ADM001', 'Large enterprise deal. Client comparing us with 2 other vendors.', '2026-02-15', '2026-04-10'),
  (2, 'IT Support Services - Annual', 'TechFlow Inc', 85000, 'USD', 'negotiation', 75, '2026-05-15', 'ADM001', 'Renewal deal. Client happy with current service.', '2026-03-01', '2026-04-18'),
  (3, 'Salesforce Migration', 'Global Retail Co', 220000, 'USD', 'qualified', 40, '2026-08-31', 'ADM001', 'Migrating from legacy CRM to Salesforce.', '2026-03-20', '2026-04-05'),
  (4, 'Web Portal Development', 'StartUp Labs', 65000, 'USD', 'closed_won', 100, '2026-03-31', 'ADM001', 'Deal closed! Project starts May 2026.', '2026-01-10', '2026-03-28'),
  (5, 'D365 Implementation Phase 2', 'Manufacturing Plus', 180000, 'USD', 'prospect', 20, '2026-09-30', 'ADM001', 'Follow-up from Phase 1. Client exploring budget.', '2026-04-01', '2026-04-15'),
  (6, 'QA Outsourcing Contract', 'FinServ Group', 120000, 'USD', 'closed_lost', 0, '2026-04-15', 'ADM001', 'Lost to competitor on pricing.', '2026-02-01', '2026-04-15')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('sales_deals', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM sales_deals), 1));

-- ninebox_placements (7)
INSERT INTO ninebox_placements (id, user_id, user_name, hourly_rate, project, potential, performance, period, notes, placed_by, placed_at) VALUES
  (1, '100070', 'Pothiraja A', 37, 'VCC - Enterprise Integration', 'high', 'high', 'Q1 2026', 'Top performer. Ready for leadership role.', 'ADM001', '2026-04-01'),
  (2, '100617', 'Vimal David', 39, 'VCC - Web B2B', 'high', 'medium', 'Q1 2026', 'High potential, needs more challenging projects.', 'ADM001', '2026-04-01'),
  (3, '100530', 'Mohammed Navazuddin', 35, 'VCC - Salesforce', 'medium', 'high', 'Q1 2026', 'Consistent performer. Strong technical skills.', 'ADM001', '2026-04-01'),
  (4, '100637', 'K P Mohammed Arif', 33, 'VCC - QA QC', 'medium', 'medium', 'Q1 2026', 'Steady contributor. Consider training opportunities.', 'ADM001', '2026-04-01'),
  (5, '100459', 'Vivekanandan Jeevanantham', 33, 'VCC - IT Helpdesk Offshore', 'low', 'high', 'Q1 2026', 'Reliable in current role. Good domain expertise.', 'ADM001', '2026-04-01'),
  (6, '111103', 'Nishandhini Ashok Kumar', 33, 'VCC - Salesforce', 'high', 'medium', 'Q1 2026', 'Fast learner. Mentorship recommended.', 'ADM001', '2026-04-01'),
  (7, '100464', 'Balaji Padmanaban', 33, 'VCC - Partner Insight', 'medium', 'low', 'Q1 2026', 'Needs performance improvement plan.', 'ADM001', '2026-04-01')
ON CONFLICT (user_id, period) DO NOTHING;
SELECT setval(pg_get_serial_sequence('ninebox_placements', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ninebox_placements), 1));

-- ── SOW resource roster (from scripts/import_sow.py) ──

-- sow_resources (66)
INSERT INTO sow_resources (id, name, project, manager, location, rate, status, sow_number, sow_file, comments) VALUES
  (1, 'Hari Chandana', 'Salesforce - Zendesk previous', 'Miti Desai', 'Offshore', 30, 'Active', '202301001', 'SOW_202301001_D4_VCC_ZenDesk.pdf', NULL),
  (2, 'Karthiga Adhimoolam', 'Salesforce - Zendesk previous', 'Miti Desai', 'Offshore', 30, 'Active', '202301001', 'SOW_202301001_D4_VCC_ZenDesk.pdf', NULL),
  (3, 'Tilak G', 'IT Infra - Help Desk', 'James Petrokus', 'Offshore', 30, 'Exit', '202404002', 'SOW_202404002_ITAdminOnsiteOffshore.pdf', 'Not part of the team from March 2026'),
  (4, 'Senthilnathan Rajagopal', 'IT Infra - Help Desk', 'James Petrokus', 'Offshore', 30, 'Active', '202404002', 'SOW_202404002_ITAdminOnsiteOffshore.pdf', NULL),
  (5, 'Vivekanandan J', 'IT Infra - Help Desk', 'James Petrokus', 'Offshore', 30, 'Active', '202404002', 'SOW_202404002_ITAdminOnsiteOffshore.pdf', NULL),
  (6, 'Akhila Reddy', 'IT Infra - Help Desk-Savanah', 'Victoria Yates', 'Onsite', 95, 'Active', '202511001', 'SOW_202511001_ITServices_Savannah_Akhila.docx.pdf', 'New SOW to be created'),
  (7, 'Anand Suchak', 'eComm - Tiger Ops', 'Ron Gliane', 'Onsite', 80, 'Active', '202509001', 'VCC_D4_SOW_202509001_eCommercePod.docx.pdf', NULL),
  (8, 'Janani Ramkumar', 'IT Infra PMO', 'James Petrokus', 'Offshore', 37, 'Active', '202406001', 'SOW_202406001_VCC_D4_PMO_Janani.pdf', NULL),
  (9, 'Aldrin Shaji', 'IT Infra 8x8 Contact Center', 'James Petrokus', 'Offshore', 37, 'Active', '202509002', 'VCC_D4_SOW_202509002_8x8.docx.pdf', NULL),
  (10, 'Mohammed Abdullah Khan', 'IT Infrastructure and Security', 'James Petrokus', 'Offshore', 32, 'Active', '202507001', 'VCC_D4_SOW_202507001_InfraSecurityTeam.docx.pdf', NULL),
  (11, 'Karthikeyan Vijayan', 'IT Infrastructure and Security', 'James Petrokus', 'Offshore', 35, 'Active', '202507001', 'VCC_D4_SOW_202507001_InfraSecurityTeam.docx.pdf', NULL),
  (12, 'Dhiraj Gurung', 'IT Infra Help Desk-Savanah', 'Victoria Yates', 'Onsite', 65, 'Active', '202504003', NULL, NULL),
  (13, 'Mark Soliz', 'IT Infra Help Desk - Onsite', 'James Petrokus', 'Onsite', 85, 'Active', '202404002', 'SOW_202404002_ITAdminOnsiteOffshore.pdf', 'Draft send not signed'),
  (14, 'Pratik Parmar', 'DataMart Project PMO', 'Rahul Agarwal', 'Onsite', 85, 'Active', '202402005', NULL, NULL),
  (15, 'Thomas Bruttell', 'JDE - Onsite', 'Bryan Brewer', 'Onsite', 110, 'Active', '202512001', 'SOW_202512001_JDE_OnsiteConsultant.docx.pdf', NULL),
  (16, 'Rafi Ghafoor', 'D365 Integration-Onsite', 'Andrew Pfister', 'Onsite', 90, 'Active', '202501001', 'SOW_202501001_IntegrationOnsiteOffshore.pdf', 'Rate increased to 90'),
  (17, 'Pothi Raja', 'D365 Integration-Offshore', 'Andrew Pfister', 'Offshore', 32, 'Active', '202501001', 'SOW_202501001_IntegrationOnsiteOffshore.pdf', NULL),
  (18, 'Krupa Vyas', 'D365 F&O', 'Matt Forsyth', 'Onsite', 38, 'Active', '202401004', 'SOW_202401004_D365_Krupa_Onsite_VCC_D4.pdf', NULL),
  (19, 'B N Reddy', 'D365 F&O', 'Matt Forsyth', 'Offshore', 32, 'Active', '202411001', NULL, NULL),
  (20, 'Srinivasan Pandiaraj', 'D365 F&O', 'Matt Forsyth', 'Offshore', 39, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', NULL),
  (21, 'Shahul Hameed', 'QA - D365 F&O', 'Kene Nwobu', 'Offshore', 30, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', NULL),
  (22, 'Meenalochini B', 'QA - D365 F&O', 'Kene Nwobu', 'Offshore', 30, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', NULL),
  (23, 'Anant Moger', 'D365 F&O', 'Matt Forsyth', 'Offshore', 32, 'Active', '202411001', NULL, NULL),
  (24, 'Kishore Babu Jyothi', 'D365 F&O', 'Matt Forsyth', 'Offshore', 39, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', NULL),
  (25, 'Sankar Raman', 'D365 F&O', 'Matt Forsyth', 'Offshore', 39, 'Active', '202507005', 'VCC_D4_SOW_202507005_D365FO_Addon.docx.pdf', NULL),
  (26, 'Manish Kumar Dayma', 'D365 F&O', 'Matt Forsyth', 'Offshore', 43, 'Active', '202507005', 'VCC_D4_SOW_202507005_D365FO_Addon.docx.pdf', NULL),
  (27, 'Thangaraj Aran', 'D365 F&O - Payment Processor', 'Matt Forsyth', 'Offshore', 0, 'Active', '202511003', 'Fixed_Bid_SOW_D365_Payment_Connector.docx.pdf', 'Fixed Bid'),
  (28, 'Muthu Krishnan', 'QA - Partner Insight', 'Kene Nwobu', 'Offshore', 32, 'Active', '202502001', 'SOW_VCC_D4_202502001_PartnerInsight.docx.pdf', NULL),
  (29, 'Mahesh Marimuthu', 'Partner Insight', 'Ron Gliane', 'Offshore', 37, 'Active', '202502001', 'SOW_VCC_D4_202502001_PartnerInsight.docx.pdf', NULL),
  (30, 'Gayathri M', 'Partner Insight', 'Ron Gliane', 'Offshore', 33, 'Active', '202502001', 'SOW_VCC_D4_202502001_PartnerInsight.docx.pdf', NULL),
  (31, 'Sasikumar Saravanan', 'Partner Insight', 'Ron Gliane', 'Offshore', 33, 'Active', '202502001', 'SOW_VCC_D4_202502001_PartnerInsight.docx.pdf', NULL),
  (32, 'Balaji Padmanaban', 'Partner Insight', 'Ron Gliane', 'Offshore', 33, 'Active', '202502001', 'SOW_VCC_D4_202502001_PartnerInsight.docx.pdf', NULL),
  (33, 'Kiran KalavaKollu', 'Partner Insight', 'Ron Gliane', 'Offshore', 35, 'Active', '202502001', 'SOW_VCC_D4_202502001_PartnerInsight.docx.pdf', NULL),
  (34, 'Ch.Nageswara Dhaveji', 'Partner Insight', 'Ron Gliane', 'Offshore', 37, 'Active', '202508002', 'SOW_VCC_D4_202508002_PartnerInsight_AddOn.docx.pdf', NULL),
  (35, 'Sandhirasegaran Munisami', 'Salesforce', 'Miti Desai', 'Offshore', 43, 'Active', '202506001', 'SOW_202506001_SalesforceCRM_VCC_D4_.docx.pdf', NULL),
  (36, 'Divya Priya S', 'Salesforce', 'Miti Desai', 'Offshore', 35, 'Active', '202506001', 'SOW_202506001_SalesforceCRM_VCC_D4_.docx.pdf', NULL),
  (37, 'Mohammad Nawazudeen', 'Salesforce', 'Miti Desai', 'Offshore', 35, 'Active', '202511004', 'VCC_D4_SOW_202511004_SalesforceCRMAddOn.docx.pdf', NULL),
  (38, 'Nishandhini Ashok Kumar', 'Salesforce', 'Miti Desai', 'Offshore', 32, 'Active', '202511004', 'VCC_D4_SOW_202511004_SalesforceCRMAddOn.docx.pdf', NULL),
  (39, 'Swaminathan B N', 'Salesforce', 'Miti Desai', 'Offshore', 35, 'Active', '202506001', 'SOW_202506001_SalesforceCRM_VCC_D4_.docx.pdf', NULL),
  (40, 'Naveenkumar Venkatesan', 'Salesforce', 'Miti Desai', 'Offshore', 30, 'Active', '202511004', 'VCC_D4_SOW_202511004_SalesforceCRMAddOn.docx.pdf', NULL),
  (41, 'Bindu Marella', 'QA - Onsite', 'Kene Nwobu', 'Onsite', 95, 'Active', '202511002', 'SOW_202511002_QAManager_Bindu.docx.pdf', NULL),
  (42, 'K P Mohammed Arif', 'QA - Performance', 'Kene Nwobu', 'Offshore', 33, 'Active', '202511005', 'SOW_202511005_PerformanceTesting.docx.pdf', NULL),
  (43, 'Aruldoss A', 'QA - eComm - Web B2B', 'Kene Nwobu', 'Offshore', 37, 'Active', '202509001', 'VCC_D4_SOW_202509001_eCommercePod.docx.pdf', NULL),
  (44, 'Jagadeesh Raju', 'eComm - Web B2B', 'Ron Gliane', 'Offshore', 39, 'Active', '202509001', 'VCC_D4_SOW_202509001_eCommercePod.docx.pdf', NULL),
  (45, 'Sathishraj Raju', 'eComm - Web B2B', 'Ron Gliane', 'Offshore', 39, 'Active', '202509001', 'VCC_D4_SOW_202509001_eCommercePod.docx.pdf', NULL),
  (46, 'Vimal David', 'eComm - Web B2B', 'Ron Gliane', 'Offshore', 39, 'Active', '202509001', 'VCC_D4_SOW_202509001_eCommercePod.docx.pdf', NULL),
  (47, 'Zamir Vahora', 'BA - eComm Onsite', 'Kene Nwobu', 'Onsite', 95, 'Active', '202510001', NULL, NULL),
  (48, 'Chandan R Prajapati', 'JDE Consultants', 'Bryan Brewer', 'Offshore', 37, 'Active', '202512002', 'SOW_202512002_JDE_EDI_Consultants.docx.pdf', NULL),
  (49, 'Nitin Kumar Pal', 'JDE Consultants', 'Bryan Brewer', 'Offshore', 37, 'Active', '202512002', 'SOW_202512002_JDE_EDI_Consultants.docx.pdf', NULL),
  (50, 'Arul Kumaran Veerattan', 'EDI Consultants', 'Bryan Brewer', 'Offshore', 37, 'Active', '202512002', 'SOW_202512002_JDE_EDI_Consultants.docx.pdf', NULL),
  (51, 'Bholeshankar Pathak', 'EDI Consultants', 'Bryan Brewer', 'Offshore', 37, 'Active', '202512002', 'SOW_202512002_JDE_EDI_Consultants.docx.pdf', NULL),
  (52, 'Bradley Lacey', 'D365 FO - Onsite', 'Matt Forsyth', 'Onsite', 85, 'Active', '202401004', 'SOW_202401004_D365_Krupa_Onsite_VCC_D4.pdf', NULL),
  (53, 'Jenna Cox', 'IT Infra - Incident Manager', 'James Petrokus', 'Onsite', 85, 'Active', '202601002', 'SOW_202601002_OnsiteIncidentManager.docx.pdf', NULL),
  (54, 'Javal Vadera', 'IT Infra - Finance Assistant', 'James Petrokus', 'Onsite', 60, 'Active', '202601001', 'SOW_202601001_OnsiteFinanceAnalyst.docx.pdf', NULL),
  (55, 'Humera Ahmed', 'Partner Insight - .NET Onsite', 'Ron Gliane', 'Onsite', 85, 'Active', '202601004', 'VCC_D4_SOW_202601004_Humera_OnsiteDotNetDevdocx.pdf', 'SOW to be reviewed and signed'),
  (56, 'Ganesh Jayaraman', 'QA - Integration', 'Kene Nwobu', 'Offshore', 35, 'Active', '202602003', 'VCC_D4_SOW_202602003_QATeam.docx.pdf', 'SOW to be reviewed and signed'),
  (57, 'Manjari', 'QA - D365 F&O', 'Kene Nwobu', 'Offshore', 33, 'Active', '202602003', 'VCC_D4_SOW_202602003_QATeam.docx.pdf', 'SOW to be reviewed and signed'),
  (58, 'Saritha Thota', 'QA - Tech Lead Onsite', 'Kene Nwobu', 'Onsite', 85, 'Active', '202602003', 'VCC_D4_SOW_202602003_QATeam.docx.pdf', 'SOW to be reviewed and signed'),
  (59, 'Aravindh Perumal', 'D365 F&O', 'Matt Forsyth', 'Offshore', 37, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', 'Functional Consultant'),
  (60, 'Abhinandhan Poorlin', 'D365 F&O', 'Matt Forsyth', 'Offshore', 35, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', 'Replacement to Santhosh'),
  (61, 'Andrea Solorzano', 'D365 F&O - Onsite', 'Matt Forsyth', 'Onsite', 0, 'Active', NULL, NULL, 'SOW to be created'),
  (62, 'Keerthivasan', 'D365 F&O', 'Matt Forsyth', 'Offshore', 37, 'Active', '202507005', 'VCC_D4_SOW_202507005_D365FO_Addon.docx.pdf', 'Replacement to Krishnakumar'),
  (63, 'Bhavesh Pandya', 'QA', 'Kene Nwobu', 'Offshore', 35, 'Active', '202602003', 'VCC_D4_SOW_202602003_QATeam.docx.pdf', 'New'),
  (64, 'Irfan Mukhtar', 'EDI - Onsite', 'Bryan Brewer', 'Onsite', 0, 'Active', NULL, NULL, 'New Onsite EDI'),
  (65, 'Madhavi Ummalanani', 'QA eComm - Onsite', 'Kene Nwobu', 'Onsite', 0, 'Active', '202602003', 'VCC_D4_SOW_202602003_QATeam.docx.pdf', 'New Onsite QA'),
  (66, 'Ashwath', 'QA eComm', 'Kene Nwobu', 'Offshore', 0, 'Active', '202502003', 'VCC_D4_SOW_202502003_D365FOTeam.docx.pdf', NULL)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('sow_resources', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM sow_resources), 1));

-- ── Client portal roster ──

-- roster_entries (25)
INSERT INTO roster_entries (id, client_id, name, role, project, billing_rate, currency, status, created_by) VALUES
  (1, 'CLT001', 'Hari Chandana', 'Salesforce - Zendesk previous', 'Salesforce - Zendesk previous', 30, 'USD', 'active', 'ADM001'),
  (2, 'CLT001', 'Karthiga Adhimoolam', 'Salesforce - Zendesk previous', 'Salesforce - Zendesk previous', 30, 'USD', 'active', 'ADM001'),
  (3, 'CLT001', 'Senthilnathan Rajagopal', 'IT Infra - Help Desk', 'IT Infra - Help Desk', 30, 'USD', 'active', 'ADM001'),
  (4, 'CLT001', 'Vivekanandan J', 'IT Infra - Help Desk', 'IT Infra - Help Desk', 30, 'USD', 'active', 'ADM001'),
  (5, 'CLT001', 'Akhila Reddy', 'IT Infra - Help Desk-Savanah', 'IT Infra - Help Desk-Savanah', 95, 'USD', 'active', 'ADM001'),
  (6, 'CLT001', 'Anand Suchak', 'eComm - Tiger Ops', 'eComm - Tiger Ops', 80, 'USD', 'active', 'ADM001'),
  (7, 'CLT001', 'Janani Ramkumar', 'IT Infra PMO', 'IT Infra PMO', 37, 'USD', 'active', 'ADM001'),
  (8, 'CLT001', 'Aldrin Shaji', 'IT Infra 8x8 Contact Center', 'IT Infra 8x8 Contact Center', 37, 'USD', 'active', 'ADM001'),
  (9, 'CLT001', 'Mohammed Abdullah Khan', 'IT Infrastructure and Security', 'IT Infrastructure and Security', 32, 'USD', 'active', 'ADM001'),
  (10, 'CLT001', 'Karthikeyan Vijayan', 'IT Infrastructure and Security', 'IT Infrastructure and Security', 35, 'USD', 'active', 'ADM001'),
  (11, 'CLT001', 'Dhiraj Gurung', 'IT Infra Help Desk-Savanah', 'IT Infra Help Desk-Savanah', 65, 'USD', 'active', 'ADM001'),
  (12, 'CLT001', 'Mark Soliz', 'IT Infra Help Desk - Onsite', 'IT Infra Help Desk - Onsite', 85, 'USD', 'active', 'ADM001'),
  (13, 'CLT001', 'Pratik Parmar', 'DataMart Project PMO', 'DataMart Project PMO', 85, 'USD', 'active', 'ADM001'),
  (14, 'CLT001', 'Thomas Bruttell', 'JDE - Onsite', 'JDE - Onsite', 110, 'USD', 'active', 'ADM001'),
  (15, 'CLT001', 'Rafi Ghafoor', 'D365 Integration-Onsite', 'D365 Integration-Onsite', 90, 'USD', 'active', 'ADM001'),
  (16, 'CLT001', 'Pothi Raja', 'D365 Integration-Offshore', 'D365 Integration-Offshore', 32, 'USD', 'active', 'ADM001'),
  (17, 'CLT001', 'Krupa Vyas', 'D365 F&O', 'D365 F&O', 38, 'USD', 'active', 'ADM001'),
  (18, 'CLT001', 'B N Reddy', 'D365 F&O', 'D365 F&O', 32, 'USD', 'active', 'ADM001'),
  (19, 'CLT001', 'Srinivasan Pandiaraj', 'D365 F&O', 'D365 F&O', 39, 'USD', 'active', 'ADM001'),
  (20, 'CLT001', 'Shahul Hameed', 'QA - D365 F&O', 'QA - D365 F&O', 30, 'USD', 'active', 'ADM001'),
  (21, 'CLT001', 'Meenalochini B', 'QA - D365 F&O', 'QA - D365 F&O', 30, 'USD', 'active', 'ADM001'),
  (22, 'CLT001', 'Anant Moger', 'D365 F&O', 'D365 F&O', 32, 'USD', 'active', 'ADM001'),
  (23, 'CLT001', 'Kishore Babu Jyothi', 'D365 F&O', 'D365 F&O', 39, 'USD', 'active', 'ADM001'),
  (24, 'CLT001', 'Sankar Raman', 'D365 F&O', 'D365 F&O', 39, 'USD', 'active', 'ADM001'),
  (25, 'CLT001', 'Manish Kumar Dayma', 'D365 F&O', 'D365 F&O', 43, 'USD', 'active', 'ADM001')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('roster_entries', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM roster_entries), 1));

-- ── Referrals ──

-- referrals (3)
INSERT INTO referrals (id, requirement_id, candidate_name, candidate_email, candidate_phone, referred_by, referred_by_name, notes, status, created_at) VALUES
  (1, 1, 'Arun Joseph Arulsekar', 'arun.joseph@example.com', '+91-9812345670', '100530', 'Mohammed Navazuddin', '6 years Salesforce, strong LWC background. Available in 30 days.', 'shortlisted', '2026-03-28T09:15:00Z'),
  (2, 3, 'Meera Sundaram', 'meera.s@example.com', '+91-9812345671', '100617', 'Vimal David', 'Full stack, React + Node. Worked on B2B commerce at previous employer.', 'submitted', '2026-04-05T11:40:00Z'),
  (3, 5, 'Rakesh Verma', 'rakesh.verma@example.com', '+91-9812345672', '100459', 'Vivekanandan Jeevanantham', 'L2 support, ServiceNow certified.', 'rejected', '2026-04-12T15:05:00Z')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('referrals', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM referrals), 1));

-- ############################################################
-- # employee_salaries (from supabase/seed-009-employee-salaries.sql)
-- ############################################################

-- Seed for employee_salaries — HR roster snapshot 2026-05-10.
-- Run after migration-009-employee-salaries.sql.

INSERT INTO employee_salaries (id, first_name, last_name, title, department, location, joined_date, ctc_amount, ctc_currency, ctc_period, ctc_raw) VALUES
('CON1041',  'Ganesh',               'Bhandari',            'Consultant',                              'Visual Comfort Company', 'USA',   '2026-05-04', 120000, 'USD', 'annual',  'Annual fee of $120,000'),
('100688',   'Arun Joseph',          'Arulsekar',           'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2026-05-04', 4000000, 'INR', 'annual', '4000000'),
('100687',   'Jaspreet Singh',       'Rahi',                'QA Technical Consultant',                 'Visual Comfort Company', 'India', '2026-05-04', 1500000, 'INR', 'annual', '1500000'),
('CON1040',  'Sukhdeep',             'Cheema',              'IT Support Engineer',                     'Visual Comfort Company', 'USA',   '2026-04-30', 37, 'USD', 'hourly', '$37/hour'),
('100684',   'Tharun',               'A P',                 'IT Support Engineer',                     'Visual Comfort Company', 'India', '2026-04-06', 305100, 'INR', 'annual', '305100'),
('D4US-010', 'Irfan',                'Mukhtar',             'JDE Technical Consultant (EDI)',          'Visual Comfort Company', 'USA',   '2026-04-06', 120000, 'USD', 'annual', '$ 120,000 per year'),
('D4US-009', 'Madhavi',              'Ummalanani',          'QA Analyst',                              'Visual Comfort Company', 'USA',   '2026-04-06', 100000, 'USD', 'annual', '$100,000 per year'),
('100683',   'Bhavesh',              'Pandya',              'Senior Software Tester',                  'Visual Comfort Company', 'India', '2026-03-25', 1000000, 'INR', 'annual', '1000000'),
('100682',   'Swetha',               'Kumar',               'Technical Consultant',                    'Visual Comfort Company', 'India', '2026-03-23', 2000004, 'INR', 'annual', '2000004'),
('100678',   'Ashwath Soosainathan', 'Pandian',             'Senior Software Tester',                  'Visual Comfort Company', 'India', '2026-03-06', 1100000, 'INR', 'annual', '1100000'),
('100677',   'Lakshmanan',           'Krishnan',            'Technical Architect',                     'Visual Comfort Company', 'India', '2026-03-05', 2800000, 'INR', 'annual', '2800000'),
('CON1037',  'Gayathri',             'Murugadas',           'Consultant',                              'Visual Comfort Company', 'India', '2026-03-02', 2600000, 'INR', 'annual', '2600000'),
('100675',   'Keerthivasan',         'Vijayagothandaraman', 'Senior Functional Consultant',            'Visual Comfort Company', 'India', '2026-03-02', 1500000, 'INR', 'annual', '1500000'),
('100672',   'B.N.',                 'Swaminathan',         'Junior Developer',                        'Visual Comfort Company', 'India', '2026-02-02', 400000, 'INR', 'annual', '400000'),
('100673',   'Reiyo Christ',         'V',                   'Junior Developer',                        'Visual Comfort Company', 'India', '2026-02-02', 400000, 'INR', 'annual', '400000'),
('100674',   'S. DHAVAN KUMAR',      'REDDY',               'Junior Developer',                        'Visual Comfort Company', 'India', '2026-02-02', 400000, 'INR', 'annual', '400000'),
('100671',   'Aakash',               'Priyadharshan P',     'Junior Developer',                        'Visual Comfort Company', 'India', '2026-02-02', 400000, 'INR', 'annual', '400000'),
('CON1036',  'Andrea',               'Solorzano',           'Consultant',                              'Visual Comfort Company', 'USA',   '2026-02-18', 52, 'USD', 'hourly', '$52 / Hour'),
('100667',   'Abhinandhan',          'P S',                 'Technical Consultant',                    'Visual Comfort Company', 'India', '2026-02-12', 1400004, 'INR', 'annual', '1400004'),
('CON1035',  'Saritha',              'Thotta',              'Consultant',                              'Visual Comfort Company', 'USA',   '2026-02-11', 58, 'USD', 'hourly', '$58 / Hour'),
('100661',   'Aravindh',             'Perumal',             'Senior Functional Consultant',            'Visual Comfort Company', 'India', '2026-01-28', 2700000, 'INR', 'annual', '2700000'),
('CON1032',  'Humera',               'Ahmed',               'Senior Full Stack Developer',             'Visual Comfort Company', 'USA',   '2026-01-22', 65, 'USD', 'hourly', 'hourly fee of USD $ 65.'),
('CON1031',  'Janna',                'Cox',                 'Consultant',                              'Visual Comfort Company', 'USA',   '2026-01-19', 57, 'USD', 'hourly', 'hourly fee of USD $ 57.'),
('100659',   'Bholeshankar',         'Pathak',              'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2026-01-19', 3000000, 'INR', 'annual', '3000000'),
('CON1029',  'Thomas',               'Bruttell',            'Consultant',                              'Visual Comfort Company', 'USA',   '2025-12-01', 75, 'USD', 'hourly', 'an hourly fee of USD $ 75'),
('100658',   'Manjari',              'Porkai',              'Senior QA Technical Consultant',          'Visual Comfort Company', 'India', '2026-01-12', 1600008, 'INR', 'annual', '1600008'),
('D4US-008', 'Javal',                'Vadera',              'Junior Financial Analyst',                'Visual Comfort Company', 'USA',   '2026-01-07', 80000, 'USD', 'annual', '$ 80,000 per year'),
('100657',   'Ganesh',               'Jayaraman',           'QA Technical Consultant',                 'Visual Comfort Company', 'India', '2026-01-07', 1600008, 'INR', 'annual', '1600008'),
('D4US-007', 'Bradley',              'Lacey',               'D365 Functional Consultant',              'Visual Comfort Company', 'USA',   '2026-01-05', 125000, 'USD', 'annual', '$ 125,000 per year.'),
('100655',   'Nitin Kumar',          'Pal',                 'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-12-15', 1400004, 'INR', 'annual', '1400004'),
('100654',   'Arul Kumaran',         'Veerattan',           'Senior Solution Architect',               'Visual Comfort Company', 'India', '2025-12-15', 3200004, 'INR', 'annual', '3200004'),
('100653',   'Chandan Ramkeval',     'Prajapati',           'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-12-15', 2500000, 'INR', 'annual', '2500000'),
('100637',   'Mohammed Arif',        'kalambur patel',      'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-11-12', 2800000, 'INR', 'annual', '2800000'),
('CON1028',  'Nishandhini',          'Ashok Kumar',         'Senior Technical Program Manager - IT',   'Visual Comfort Company', 'USA',   '2025-11-06', 900, 'INR', 'hourly', 'INR 900 per hour-'),
('CON1027',  'Akhila',               'Reddy',               'Consultant',                              'Visual Comfort Company', 'USA',   '2025-11-03', NULL, NULL, 'unknown', 'Yet to receive'),
('CON1026',  'Zamir',                'Vahora',              'Consultant',                              'Visual Comfort Company', 'USA',   '2025-11-03', NULL, NULL, 'unknown', 'Yet to receive'),
('D4US-006', 'Bindu',                'Marella',             'Manager - Quality Analyst',               'Visual Comfort Company', 'USA',   '2025-10-27', 130000, 'USD', 'annual', '130,000 per year'),
('100616',   'Jagadeesh',            'Raju',                'Senior Architect',                        'Visual Comfort Company', 'India', '2025-10-06', 3000000, 'INR', 'annual', '3000000'),
('100617',   'Vimal',                'David',               'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-10-06', 1800000, 'INR', 'annual', '1800000'),
('100610',   'Aruldoss',             'A',                   'Technical Consultant',                    'Visual Comfort Company', 'India', '2025-09-18', 800000, 'INR', 'annual', '800000'),
('100611',   'Sathishraj',           'Raju',                'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-09-22', 2700000, 'INR', 'annual', '2700000'),
('CON1039',  'Marcos',               'Soliz',               'Consultant',                              'Visual Comfort Company', 'USA',   '2025-09-22', 80000, 'USD', 'annual', '$ 80,000 per year.'),
('100586',   'Aldrin',               'Shaji',               'Senior Support Engineer',                 'Visual Comfort Company', 'India', '2025-09-01', 1200000, 'INR', 'annual', '1200000'),
('100573',   'Divya',                'Priya',               'Senior Developer',                        'Visual Comfort Company', 'India', '2025-08-14', 800000, 'INR', 'annual', '800000'),
('100689',   'Chintalakonda',        'Rajesh',              'Analyst- Trainee',                        'Visual Comfort Company', 'India', '2026-05-04', 300000, 'INR', 'annual', '300000'),
('100564',   'Karthikeyan',          'Vijayan',             'Senior Security Consultant',              'Visual Comfort Company', 'India', '2025-08-01', 4000000, 'INR', 'annual', '4000000'),
('100553',   'Mohammed Abdullah',    'Khan',                'Senior Security Consultant',              'Visual Comfort Company', 'India', '2025-07-15', 3300000, 'INR', 'annual', '3300000'),
('100544',   'Nageswara Dhaveji',    'Ch',                  'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-07-09', 2100000, 'INR', 'annual', '2100000'),
('100530',   'Mohammed',             'Navazuddin',          'Technical Consultant',                    'Visual Comfort Company', 'India', '2025-07-01', 2100000, 'INR', 'annual', '2100000'),
('100518',   'Sankar',               'Raman P',             'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-06-19', 2200000, 'INR', 'annual', '2200000'),
('CON1023',  'Gilberto',             'Gomez',               'Consultant',                              'Visual Comfort Company', 'USA',   '2025-04-14', NULL, NULL, 'unknown', 'Yet to receive'),
('100476',   'Senthil Nathan',       'Rajagopal',           'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-04-02', 1400000, 'INR', 'annual', '1400000'),
('100474',   'Kiran',                'KalavaKollu',         'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-04-01', 2700000, 'INR', 'annual', '2700000'),
('100464',   'Balaji',               'Padmanaban',          'Senior Developer',                        'Visual Comfort Company', 'India', '2025-03-10', 800004, 'INR', 'annual', '800004'),
('100463',   'Sasikumar',            'Saravanan',           'Software Developer',                      'Visual Comfort Company', 'India', '2025-03-07', 750000, 'INR', 'annual', '750000'),
('343',      'Janani',               'Ramkumar',            'Project Manager',                         'Visual Comfort Company', 'UAE',   '2025-02-27', 9000, 'AED', 'monthly', '9000 AED'),
('100460',   'Muthu',                'Krishnan',            'Senior Software Tester',                  'Visual Comfort Company', 'India', '2025-02-25', 900000, 'INR', 'annual', '900000'),
('100459',   'Vivekanandan',         'Jeevanantham',        'Senior Help Desk',                        'Visual Comfort Company', 'India', '2025-02-24', 800000, 'INR', 'annual', '800000'),
('100458',   'Srinivasan',           'Pandiaraj',           'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2025-02-17', 4800000, 'INR', 'annual', '4800000'),
('D4US-001', 'Anand',                'Suchak',              'Senior Program Manager',                  'Visual Comfort Company', 'USA',   '2024-09-09', 100000, 'USD', 'annual', '$100,000 per year'),
('CON1011',  'Rafi',                 'ghafoor',             'Consultant',                              'Visual Comfort Company', 'USA',   '2024-06-02', NULL, NULL, 'unknown', 'Yet to receive'),
('100343',   'Manish',               'Dayma',               'Senior Technical Consultant',             'Visual Comfort Company', 'India', '2024-01-16', 5400000, 'INR', 'annual', '5400000'),
('100338',   'Thilak',               'G',                   'IT - Support Lead',                       'Visual Comfort Company', 'India', '2023-11-29', 1045450, 'INR', 'annual', '1045450'),
('100337',   'Anant',                'Moger',               'Technical Consultant',                    'Visual Comfort Company', 'India', '2023-10-30', 1600000, 'INR', 'annual', '1600000'),
('100329',   'Naveenkumar',          'Venkatesan',          'Senior Developer',                        'Visual Comfort Company', 'India', '2023-08-29', 1347500, 'INR', 'annual', '1347500'),
('100307',   'Hari Chandana',        'P',                   'Senior Developer',                        'Visual Comfort Company', 'India', '2022-12-19', 2100000, 'INR', 'annual', '2100000'),
('100489',   'Mahesh',               'Marimuthu',           'Solution Architect',                      'Visual Comfort Company', 'India', '2025-04-28', 3652532, 'INR', 'annual', '3652532'),
('100226',   'Karthiga',             'Adhimoolam',          'Technical Consultant',                    'Visual Comfort Company', 'India', '2021-06-28', 1622500, 'INR', 'annual', '1622500'),
('100113',   'Meenalochini',         'B',                   'Senior Software Engineer',                'Visual Comfort Company', 'India', '2019-11-06', 840000, 'INR', 'annual', '840000'),
('100107',   'Shahul Hameed',        'I',                   'Lead Software Tester',                    'Visual Comfort Company', 'India', '2019-10-28', 1250000, 'INR', 'annual', '1250000'),
('100048',   'Krupa',                'Sarkar',              'Program Manager',                         'Visual Comfort Company', 'India', '2018-10-10', 4425200, 'INR', 'annual', '4425200')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  title = EXCLUDED.title,
  department = EXCLUDED.department,
  location = EXCLUDED.location,
  joined_date = EXCLUDED.joined_date,
  ctc_amount = EXCLUDED.ctc_amount,
  ctc_currency = EXCLUDED.ctc_currency,
  ctc_period = EXCLUDED.ctc_period,
  ctc_raw = EXCLUDED.ctc_raw,
  updated_at = now();

-- ############################################################
-- # bulk demo data (supabase/_build/seed-bulk.sql)
-- ############################################################

-- ============================================================
-- Bulk demo data — fills the app for a client walkthrough.
--
-- Appended to seed-demo.sql by build-seed.mjs. Unlike the fixture
-- section above, this is INSERT ... SELECT over whoever actually
-- exists in `users`, so it covers the full 69-person roster from
-- migration-006 rather than the 19 names in demoData.js.
--
-- Every section is guarded so a re-run is a no-op.
--
-- PERIOD LABELS MATTER. src/data/mockData.js getFortnightlyPeriods()
-- builds 14-day periods from a fixed epoch of Mon 5 Jan 2026 and
-- labels them 'MMM d - MMM d, yyyy'. A timesheet whose period_label
-- does not match one of those strings is invisible in the UI -- it is
-- keyed by (user_id, period_label), not by date. The literals below
-- are taken from that function, not invented.
-- ============================================================

-- ── Retire rows from the first version of this seed ──
-- An earlier seed-demo.sql shipped six timesheets labelled
-- 'Apr 1 - Apr 15, 2026' and one invoice covering Apr 1-15. Neither is
-- generated any more:
--
--   * that period label is not one getFortnightlyPeriods() ever produces,
--     so those timesheets are unreachable in the UI and show up only as an
--     orphan row in history;
--   * Apr 1-15 straddles two of the fortnights billed below, so leaving the
--     invoice in place double-counts those hours in the finance dashboard.
--
-- Both are demo artefacts, so deleting them is safe.
--
-- Children must go first. schema.sql declares timesheet_entries.timesheet_id
-- with ON DELETE CASCADE, but migration-006 drops every foreign key that
-- references users and re-adds this one WITHOUT the cascade clause (see
-- migration-006-all-employees.sql:189), so the cascade is not actually in
-- place. Deleting the parent first fails with 23503.
DELETE FROM invoice_lines
WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = 'INV-2026-0001');
DELETE FROM invoices WHERE invoice_number = 'INV-2026-0001';

DELETE FROM timesheet_entries
WHERE timesheet_id IN (SELECT id FROM timesheets WHERE period_label = 'Apr 1 - Apr 15, 2026');
DELETE FROM timesheets WHERE period_label = 'Apr 1 - Apr 15, 2026';


-- ── Duplicate email cleanup ──
-- ADM002 and 200031 are both Gayathri Murugadas with the same address.
-- /auth/email-login resolves accounts with .maybeSingle(), which errors
-- on more than one match, so any future allowlist entry for that address
-- would fail to log in. Keep 200031 (has a project and roster history).
UPDATE users SET email = NULL
WHERE id = 'ADM002'
  AND email IS NOT NULL
  AND EXISTS (SELECT 1 FROM users o WHERE o.email = users.email AND o.id <> users.id);


-- ============================================================
-- TIMESHEETS — 10 fortnightly periods for every active employee
-- ============================================================
-- Ends on the period containing 2026-08-07 so the demo opens on a
-- part-filled current timesheet, with one period awaiting approval
-- behind it and eight months of approved history before that.

-- The fortnightly periods are repeated inline in each statement below rather
-- than held in a TEMP TABLE. The Supabase SQL Editor does not reliably keep a
-- session-scoped temp table alive across the whole script, which fails with
-- 42P01 "relation _periods does not exist". Inline VALUES makes every
-- statement self-contained and independent of how the editor batches them.

INSERT INTO timesheets (
  user_id, user_name, user_project, period_label, status, total_hours,
  submitted_at, client_approval_status, client_approved_by, client_approved_at, updated_at
)
SELECT
  u.id, u.name, u.project, p.label, p.status,
  0,  -- recomputed from entries below
  CASE WHEN p.status IN ('submitted', 'approved') THEN p.end_date + INTERVAL '1 day' END,
  CASE WHEN p.status = 'approved' THEN 'approved'
       WHEN p.status = 'submitted' THEN 'pending' END,
  CASE WHEN p.status = 'approved' THEN 'CLI002' END,
  CASE WHEN p.status = 'approved' THEN p.end_date + INTERVAL '3 days' END,
  p.end_date + INTERVAL '1 day'
FROM users u
CROSS JOIN (VALUES
    ('2026-03-30'::date, '2026-04-12'::date, 'Mar 30 - Apr 12, 2026', 'approved'),
    ('2026-04-13'::date, '2026-04-26'::date, 'Apr 13 - Apr 26, 2026', 'approved'),
    ('2026-04-27'::date, '2026-05-10'::date, 'Apr 27 - May 10, 2026', 'approved'),
    ('2026-05-11'::date, '2026-05-24'::date, 'May 11 - May 24, 2026', 'approved'),
    ('2026-05-25'::date, '2026-06-07'::date, 'May 25 - Jun 7, 2026',  'approved'),
    ('2026-06-08'::date, '2026-06-21'::date, 'Jun 8 - Jun 21, 2026',  'approved'),
    ('2026-06-22'::date, '2026-07-05'::date, 'Jun 22 - Jul 5, 2026',  'approved'),
    ('2026-07-06'::date, '2026-07-19'::date, 'Jul 6 - Jul 19, 2026',  'approved'),
    ('2026-07-20'::date, '2026-08-02'::date, 'Jul 20 - Aug 2, 2026',  'submitted'),
    ('2026-08-03'::date, '2026-08-16'::date, 'Aug 3 - Aug 16, 2026',  'saved')
  ) AS p(start_date, end_date, label, status)
WHERE u.is_active
  AND u.role IN ('employee', 'manager')
  AND u.project IS NOT NULL
ON CONFLICT (user_id, period_label) DO NOTHING;

-- Daily entries. Weekends are zero-hour rows (the grid renders them), weekdays
-- get 7.5-9h varied deterministically off md5(user||date) so the totals are not
-- a flat 8.00 everywhere. Nothing is dated into the future.
INSERT INTO timesheet_entries (timesheet_id, date, day_name, work_item, description, hours)
SELECT
  t.id,
  d::date,
  to_char(d, 'FMDay'),
  CASE WHEN EXTRACT(ISODOW FROM d) >= 6 THEN NULL ELSE t.user_project END,
  CASE WHEN EXTRACT(ISODOW FROM d) >= 6 THEN NULL
       ELSE (ARRAY[
         'Feature development and code review',
         'Sprint tasks, standup and backlog grooming',
         'Bug fixes and regression testing',
         'Integration work and deployment support',
         'Requirement analysis and documentation',
         'Client calls and status reporting'
       ])[1 + (('x' || substr(md5(t.user_id || d::text), 1, 8))::bit(32)::bigint % 6)]
  END,
  CASE WHEN EXTRACT(ISODOW FROM d) >= 6 THEN 0
       ELSE (ARRAY[7.5, 8, 8, 8, 8.5, 9])[
         1 + (('x' || substr(md5(t.user_id || d::text || 'h'), 1, 8))::bit(32)::bigint % 6)]
  END
FROM timesheets t
JOIN (VALUES
    ('2026-03-30'::date, '2026-04-12'::date, 'Mar 30 - Apr 12, 2026', 'approved'),
    ('2026-04-13'::date, '2026-04-26'::date, 'Apr 13 - Apr 26, 2026', 'approved'),
    ('2026-04-27'::date, '2026-05-10'::date, 'Apr 27 - May 10, 2026', 'approved'),
    ('2026-05-11'::date, '2026-05-24'::date, 'May 11 - May 24, 2026', 'approved'),
    ('2026-05-25'::date, '2026-06-07'::date, 'May 25 - Jun 7, 2026',  'approved'),
    ('2026-06-08'::date, '2026-06-21'::date, 'Jun 8 - Jun 21, 2026',  'approved'),
    ('2026-06-22'::date, '2026-07-05'::date, 'Jun 22 - Jul 5, 2026',  'approved'),
    ('2026-07-06'::date, '2026-07-19'::date, 'Jul 6 - Jul 19, 2026',  'approved'),
    ('2026-07-20'::date, '2026-08-02'::date, 'Jul 20 - Aug 2, 2026',  'submitted'),
    ('2026-08-03'::date, '2026-08-16'::date, 'Aug 3 - Aug 16, 2026',  'saved')
  ) AS p(start_date, end_date, label, status) ON p.label = t.period_label
CROSS JOIN LATERAL generate_series(p.start_date, LEAST(p.end_date, DATE '2026-08-07'), INTERVAL '1 day') d
ON CONFLICT (timesheet_id, date) DO NOTHING;

UPDATE timesheets t SET total_hours = e.sum_hours
FROM (SELECT timesheet_id, SUM(hours) AS sum_hours FROM timesheet_entries GROUP BY timesheet_id) e
WHERE e.timesheet_id = t.id AND t.total_hours IS DISTINCT FROM e.sum_hours;


-- ============================================================
-- TASKS — a live board for every active employee
-- ============================================================
INSERT INTO tasks (
  user_id, user_name, assigned_by, assigned_by_name, title, description,
  date, priority, status, estimated_hours, actual_hours, completed_at, created_at, updated_at
)
SELECT
  u.id, u.name,
  COALESCE(m.id, 'ADM001'), COALESCE(m.name, 'Kishore'),
  (ARRAY[
    'Review pull request and leave comments',
    'Fix defect raised in UAT',
    'Update automated test coverage',
    'Prepare release notes for this sprint',
    'Refactor the integration adapter',
    'Investigate slow report query',
    'Document the deployment runbook',
    'Pair on the onboarding flow',
    'Triage incoming support tickets',
    'Update dependency versions'
  ])[1 + ((('x' || substr(md5(u.id || g::text), 1, 8))::bit(32)::bigint) % 10)],
  'Tracked for the ' || u.project || ' workstream.',
  DATE '2026-08-07' - (((('x' || substr(md5(u.id || g::text || 'd'), 1, 8))::bit(32)::bigint) % 21)::int),
  (ARRAY['low', 'medium', 'medium', 'high', 'urgent'])[
    1 + ((('x' || substr(md5(u.id || g::text || 'p'), 1, 8))::bit(32)::bigint) % 5)],
  (ARRAY['pending', 'in_progress', 'completed', 'completed'])[
    1 + ((('x' || substr(md5(u.id || g::text || 's'), 1, 8))::bit(32)::bigint) % 4)],
  4 + (g * 2),
  NULL, NULL,
  DATE '2026-08-07' - (((('x' || substr(md5(u.id || g::text || 'd'), 1, 8))::bit(32)::bigint) % 21)::int),
  DATE '2026-08-07'
FROM users u
LEFT JOIN users m ON m.role = 'manager' AND m.project = u.project
CROSS JOIN generate_series(1, 4) g
WHERE u.is_active AND u.role IN ('employee', 'manager')
  AND NOT EXISTS (SELECT 1 FROM tasks x WHERE x.user_id = u.id AND x.id > 24);

-- Completed tasks need an actual-hours figure and a completion date.
UPDATE tasks
SET actual_hours = GREATEST(1, estimated_hours - 1), completed_at = date
WHERE status = 'completed' AND actual_hours IS NULL;


-- ============================================================
-- LEAVE — requests across the roster, some awaiting approval
-- ============================================================
INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days)
SELECT u.id || '_' || lt.t, u.id, lt.t, 2026,
  CASE lt.t WHEN 'casual' THEN 12 WHEN 'sick' THEN 10 ELSE 15 END,
  (('x' || substr(md5(u.id || lt.t), 1, 8))::bit(32)::bigint % 5)
FROM users u
CROSS JOIN (VALUES ('casual'), ('sick'), ('earned')) AS lt(t)
WHERE u.is_active AND u.role IN ('employee', 'manager')
ON CONFLICT (id) DO NOTHING;

INSERT INTO leaves (
  user_id, user_name, leave_type, start_date, end_date, days_count,
  reason, status, approved_by, approved_at, created_at
)
SELECT
  u.id, u.name,
  (ARRAY['casual', 'sick', 'earned', 'wfh'])[
    1 + ((('x' || substr(md5(u.id || g::text || 'lt'), 1, 8))::bit(32)::bigint) % 4)],
  st.d, st.d + (g % 2),
  1 + (g % 2),
  (ARRAY[
    'Family commitment',
    'Medical appointment',
    'Personal work',
    'Travel',
    'Working from home - internet installation',
    'Festival holiday'
  ])[1 + ((('x' || substr(md5(u.id || g::text || 'r'), 1, 8))::bit(32)::bigint) % 6)],
  CASE WHEN st.d > DATE '2026-08-07' THEN 'pending'
       WHEN (('x' || substr(md5(u.id || g::text || 'st'), 1, 8))::bit(32)::bigint) % 8 = 0 THEN 'rejected'
       ELSE 'approved' END,
  CASE WHEN st.d <= DATE '2026-08-07' THEN COALESCE(m.id, 'ADM001') END,
  CASE WHEN st.d <= DATE '2026-08-07' THEN st.d - 2 END,
  st.d - 7
FROM users u
LEFT JOIN users m ON m.role = 'manager' AND m.project = u.project
CROSS JOIN generate_series(1, 2) g
CROSS JOIN LATERAL (
  SELECT DATE '2026-05-01'
    + (((('x' || substr(md5(u.id || g::text || 'sd'), 1, 8))::bit(32)::bigint) % 120)::int) AS d
) st
WHERE u.is_active AND u.role IN ('employee', 'manager')
  AND NOT EXISTS (SELECT 1 FROM leaves x WHERE x.user_id = u.id AND x.id > 8);


-- ============================================================
-- FINANCE — invoices with real line items derived from timesheets
-- ============================================================
-- Each invoice covers one fortnight; the lines are the actual approved
-- hours per project at that project's bill_rate, so the finance
-- dashboard's revenue figures tie back to the timesheet data.

INSERT INTO invoices (
  invoice_number, client_id, period_start, period_end, issue_date, due_date,
  currency, subtotal, total_amount, status, paid_at, notes, created_by,
  client_manager_approved_by, client_manager_approved_at, created_at, updated_at
)
SELECT
  'INV-2026-' || LPAD((1000 + ROW_NUMBER() OVER (ORDER BY p.start_date))::text, 4, '0'),
  'CLT001', p.start_date, p.end_date, p.end_date + 1, p.end_date + 31,
  'USD', 0, 0,
  CASE WHEN p.end_date < DATE '2026-06-15' THEN 'paid'
       WHEN p.end_date < DATE '2026-07-20' THEN 'sent'
       ELSE 'draft' END,
  CASE WHEN p.end_date < DATE '2026-06-15' THEN p.end_date + 25 END,
  'Fortnightly billing — ' || p.label,
  'FIN001',
  CASE WHEN p.end_date < DATE '2026-07-20' THEN 'CLI002' END,
  CASE WHEN p.end_date < DATE '2026-07-20' THEN p.end_date + 5 END,
  p.end_date + 1, p.end_date + 1
FROM (VALUES
    ('2026-03-30'::date, '2026-04-12'::date, 'Mar 30 - Apr 12, 2026', 'approved'),
    ('2026-04-13'::date, '2026-04-26'::date, 'Apr 13 - Apr 26, 2026', 'approved'),
    ('2026-04-27'::date, '2026-05-10'::date, 'Apr 27 - May 10, 2026', 'approved'),
    ('2026-05-11'::date, '2026-05-24'::date, 'May 11 - May 24, 2026', 'approved'),
    ('2026-05-25'::date, '2026-06-07'::date, 'May 25 - Jun 7, 2026',  'approved'),
    ('2026-06-08'::date, '2026-06-21'::date, 'Jun 8 - Jun 21, 2026',  'approved'),
    ('2026-06-22'::date, '2026-07-05'::date, 'Jun 22 - Jul 5, 2026',  'approved'),
    ('2026-07-06'::date, '2026-07-19'::date, 'Jul 6 - Jul 19, 2026',  'approved'),
    ('2026-07-20'::date, '2026-08-02'::date, 'Jul 20 - Aug 2, 2026',  'submitted'),
    ('2026-08-03'::date, '2026-08-16'::date, 'Aug 3 - Aug 16, 2026',  'saved')
  ) AS p(start_date, end_date, label, status)
WHERE p.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.period_start = p.start_date)
ORDER BY p.start_date;

INSERT INTO invoice_lines (invoice_id, project_id, project_name, description, hours, rate, amount)
SELECT
  i.id, bp.id, bp.name,
  'Delivery hours — ' || bp.name,
  SUM(te.hours),
  bp.bill_rate,
  ROUND(SUM(te.hours) * bp.bill_rate, 2)
FROM invoices i
JOIN timesheets t
  ON t.status = 'approved'
JOIN timesheet_entries te
  ON te.timesheet_id = t.id
 AND te.date BETWEEN i.period_start AND i.period_end
JOIN billable_projects bp
  ON bp.name = t.user_project
WHERE NOT EXISTS (SELECT 1 FROM invoice_lines il WHERE il.invoice_id = i.id)
  AND te.hours > 0
GROUP BY i.id, bp.id, bp.name, bp.bill_rate;

UPDATE invoices i
SET subtotal = l.total, total_amount = l.total
FROM (SELECT invoice_id, SUM(amount) AS total FROM invoice_lines GROUP BY invoice_id) l
WHERE l.invoice_id = i.id AND i.total_amount IS DISTINCT FROM l.total;


-- ============================================================
-- VENDORS — migration-022 leaves only D4 Insight; add the rest
-- ============================================================
INSERT INTO vendors (id, client_id, name, category, contact_name, contact_email, phone, region, status, engagement_start, notes) VALUES
  ('VEN-INFO', 'CLT001', 'Infosys',            'Consulting & Delivery',  'Engagement Lead',   'vcc@infosys.com',        '+1-2125550143', 'India / USA', 'active',   '2023-02-01', 'D365 programme support.'),
  ('VEN-CGNZ', 'CLT001', 'Cognizant',          'Application Management', 'Client Partner',    'vcc@cognizant.com',      '+1-2015550178', 'India / USA', 'active',   '2023-08-15', 'Application maintenance for JDE and EDI.'),
  ('VEN-ACCN', 'CLT001', 'Accenture',          'Advisory',               'Managing Director', 'vcc@accenture.com',      '+1-9175550110', 'USA',         'active',   '2024-01-10', 'Programme governance and architecture review.'),
  ('VEN-CLDW', 'CLT001', 'CloudWorks Partners','Cloud Infrastructure',   'Service Manager',   'support@cloudworks.io',  '+1-4155550164', 'USA',         'active',   '2024-06-01', 'AWS landing zone and 24x7 operations.'),
  ('VEN-BRTP', 'CLT001', 'BrightPath Design',  'Design & Creative',      'Studio Lead',       'hello@brightpath.design','+91-9000012345','India',       'inactive', '2022-11-01', 'Storefront visual design — engagement closed.')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SOWs — cover the remaining lifecycle states
-- ============================================================
INSERT INTO sows (
  sow_number, client_id, project_id, title, sow_type, description,
  contract_value, currency, start_date, end_date, status,
  resource_name, resource_role, resource_rate,
  finance_approved_by, finance_approved_at, finance_notes,
  manager_signed_by, manager_signed_at, docusign_envelope_id, docusign_status,
  rejected_by, rejected_at, rejection_reason,
  created_by, created_at, updated_at
) VALUES
  ('SOW-2026-0008', 'CLT001', 'BP003', 'QA QC – Automation Coverage Expansion', 'project',
   'Raise automated regression coverage to 80% across the D365 and Salesforce suites.',
   96000, 'USD', '2026-08-01', '2027-01-31', 'draft',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   'ADM001', '2026-07-28T10:00:00Z', '2026-07-28T10:00:00Z'),
  ('SOW-2026-0009', 'CLT001', 'BP008', 'D365 FO – Payment Connector (Fixed Bid)', 'project',
   'Fixed-bid delivery of the payment processor connector, including UAT support.',
   64000, 'USD', '2026-06-15', '2026-11-30', 'signed',
   NULL, NULL, NULL, 'CLI001', '2026-06-02T09:30:00Z', 'Fixed bid agreed.',
   'CLI002', '2026-06-10T15:00:00Z', 'DEMO-DS-8102-C3', 'completed',
   NULL, NULL, NULL, 'ADM001', '2026-05-25T08:00:00Z', '2026-06-10T15:00:00Z'),
  ('SOW-2026-0010', 'CLT001', 'BP006', 'IT Helpdesk – Weekend Coverage Add-on', 'amendment',
   'Adds Saturday coverage to the offshore helpdesk rota.',
   28000, 'USD', '2026-09-01', '2027-08-31', 'changes_requested',
   NULL, NULL, NULL, NULL, NULL, 'Please split the rate card by shift before we approve.',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   'ADM001', '2026-07-20T11:00:00Z', '2026-07-30T16:20:00Z'),
  ('SOW-2026-0011', 'CLT001', 'BP014', 'Business Analyst – Onsite Extension', 'resource',
   'Extends the onsite BA engagement by a further 12 months.',
   198000, 'USD', '2026-09-01', '2027-08-31', 'rejected',
   'Zamir Vahora', 'Senior Business Analyst', 95,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   'CLI001', '2026-07-18T14:00:00Z', 'Budget deferred to next fiscal year.',
   'ADM001', '2026-07-05T09:00:00Z', '2026-07-18T14:00:00Z')
ON CONFLICT (sow_number) DO NOTHING;


-- ============================================================
-- 9-BOX — place the whole active roster for the current quarter
-- ============================================================
INSERT INTO ninebox_placements (
  user_id, user_name, hourly_rate, project, potential, performance, period, notes, placed_by, placed_at
)
SELECT
  u.id, u.name, COALESCE(NULLIF(u.hourly_rate, 0), 35), u.project,
  (ARRAY['low', 'medium', 'medium', 'high', 'high'])[
    1 + ((('x' || substr(md5(u.id || 'pot'), 1, 8))::bit(32)::bigint) % 5)],
  (ARRAY['low', 'medium', 'medium', 'high', 'high'])[
    1 + ((('x' || substr(md5(u.id || 'perf'), 1, 8))::bit(32)::bigint) % 5)],
  'Q3 2026',
  (ARRAY[
    'Consistent delivery this quarter.',
    'Strong technical depth; ready for more scope.',
    'Needs mentoring on stakeholder communication.',
    'Reliable in role, limited stretch appetite.',
    'High potential — candidate for lead track.',
    'Performance improvement plan in progress.'
  ])[1 + ((('x' || substr(md5(u.id || 'n'), 1, 8))::bit(32)::bigint) % 6)],
  'ADM001', '2026-07-01'
FROM users u
WHERE u.is_active AND u.role IN ('employee', 'manager')
ON CONFLICT (user_id, period) DO NOTHING;


-- ============================================================
-- KPI SCORES
-- ============================================================
INSERT INTO kpi_scores (user_id, period, score, category, notes, scored_by, scored_at)
SELECT
  u.id, q.period,
  ROUND((60 + ((('x' || substr(md5(u.id || q.period || c.cat), 1, 8))::bit(32)::bigint) % 41))::numeric, 2),
  c.cat,
  'Quarterly review score.',
  'ADM001', (q.period_end)::timestamptz
FROM users u
CROSS JOIN (VALUES ('Q1 2026', DATE '2026-03-31'), ('Q2 2026', DATE '2026-06-30')) AS q(period, period_end)
CROSS JOIN (VALUES ('Delivery'), ('Quality'), ('Collaboration')) AS c(cat)
WHERE u.is_active AND u.role IN ('employee', 'manager')
  AND NOT EXISTS (SELECT 1 FROM kpi_scores k WHERE k.user_id = u.id AND k.period = q.period AND k.category = c.cat);


-- ============================================================
-- SALES pipeline activity
-- ============================================================
INSERT INTO sales_activities (deal_id, activity_type, description, created_by, created_at)
SELECT d.id, a.t, a.descr, 'ADM001', d.created_at::timestamptz + (a.offset_days || ' days')::interval
FROM sales_deals d
CROSS JOIN (VALUES
  ('call',    'Discovery call with the client sponsor.',                 3),
  ('email',   'Sent capability deck and reference case studies.',        7),
  ('meeting', 'Solution walkthrough with the technical evaluators.',    14),
  ('note',    'Procurement flagged a competing bid on price.',          21)
) AS a(t, descr, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM sales_activities s WHERE s.deal_id = d.id);


-- ============================================================
-- AI MEETING NOTES
-- ============================================================
INSERT INTO meeting_notes_ai (
  calendar_event_id, title, meeting_date, meeting_end, organizer, attendees,
  transcript_source, summary, minutes_html, key_decisions, action_items,
  status, processed_at, email_sent, email_sent_at
) VALUES
  ('DEMO-EVT-001', 'VCC Delivery Governance — July Review',
   '2026-07-28T09:00:00Z', '2026-07-28T10:00:00Z', 'kishore@d4insight.com',
   '[{"email":"kishore@d4insight.com","name":"Kishore"},{"email":"pothi.raja@d4insight.com","name":"Pothiraja A"},{"email":"vimal.david@d4insight.com","name":"Vimal David"}]'::jsonb,
   'teams_auto',
   'Reviewed delivery health across all six workstreams. Salesforce and Web B2B are on track; D365 F&O is carrying a two-week slip on the payment connector. Agreed to add one QA resource to the eCommerce pod and to bring the August release forward by a week.',
   '<h3>Delivery Governance — July Review</h3><ul><li>Salesforce: on track, CPQ defects closed.</li><li>Web B2B: on track, checkout redesign in UAT.</li><li>D365 F&amp;O: two-week slip on the payment connector.</li><li>QA: automation coverage at 62%, target 80%.</li></ul>',
   '[{"decision":"Add one QA resource to the eCommerce pod","context":"Coverage gap in checkout regression"},{"decision":"Bring the August release forward by one week","context":"Client marketing campaign dependency"}]'::jsonb,
   '[{"task":"Raise a SOW for the additional QA resource","assignee":"Kishore","due_date":"2026-08-05","status":"open"},{"task":"Re-baseline the D365 connector plan","assignee":"Pothiraja A","due_date":"2026-08-03","status":"in_progress"}]'::jsonb,
   'completed', '2026-07-28T10:15:00Z', true, '2026-07-28T10:20:00Z'),
  ('DEMO-EVT-002', 'Salesforce CPQ — Integration Checkpoint',
   '2026-08-04T13:30:00Z', '2026-08-04T14:15:00Z', 'sandhirasegaran.m@d4insight.com',
   '[{"email":"sandhirasegaran.m@d4insight.com","name":"Sandhisegaran Munisami"},{"email":"mohammed.navazuddin@d4insight.com","name":"Mohammed Navazuddin"}]'::jsonb,
   'teams_auto',
   'Walked through the remaining CPQ integration defects ahead of UAT sign-off. Three blockers remain, all pricing-rule related. Agreed a fix-and-retest cycle inside the current fortnight.',
   '<h3>Salesforce CPQ — Integration Checkpoint</h3><p>Three pricing-rule blockers remain before UAT sign-off. Fix and retest inside the current fortnight.</p>',
   '[{"decision":"Hold UAT sign-off until pricing rules pass","context":"Three open blockers"}]'::jsonb,
   '[{"task":"Fix discount cascade rule","assignee":"Mohammed Navazuddin","due_date":"2026-08-08","status":"open"},{"task":"Re-run the CPQ regression pack","assignee":"Nishandhini Ashok Kumar","due_date":"2026-08-11","status":"open"}]'::jsonb,
   'completed', '2026-08-04T14:30:00Z', true, '2026-08-04T14:35:00Z'),
  ('DEMO-EVT-003', 'Infra & Security — Weekly Sync',
   '2026-08-06T06:30:00Z', '2026-08-06T07:00:00Z', 'james.petrokus@visualcomfort.com',
   '[{"email":"mohammed.abdullah@d4insight.com","name":"Mohammed Abdullah Khan"},{"email":"karthikeyan.vijayan@d4insight.com","name":"Karthikeyan Vijayan"}]'::jsonb,
   'manual',
   'Patch cycle completed across all non-production estates. One outstanding finding on the legacy reporting host, scheduled for decommission.',
   '<h3>Infra &amp; Security — Weekly Sync</h3><p>Patch cycle complete on non-production. Legacy reporting host pending decommission.</p>',
   '[{"decision":"Decommission the legacy reporting host","context":"Outstanding security finding"}]'::jsonb,
   '[{"task":"Schedule decommission window","assignee":"Karthikeyan Vijayan","due_date":"2026-08-14","status":"open"}]'::jsonb,
   'completed', '2026-08-06T07:10:00Z', false, NULL)
ON CONFLICT (calendar_event_id) DO NOTHING;

INSERT INTO meeting_action_items (meeting_note_id, task, assignee, assignee_user_id, due_date, status)
SELECT n.id, a.task, a.assignee, u.id, a.due_date::date, a.status
FROM meeting_notes_ai n
CROSS JOIN LATERAL jsonb_to_recordset(n.action_items)
  AS a(task TEXT, assignee TEXT, due_date TEXT, status TEXT)
LEFT JOIN users u ON u.name = a.assignee
WHERE NOT EXISTS (SELECT 1 FROM meeting_action_items m WHERE m.meeting_note_id = n.id);


-- ============================================================
-- SOP templates + issued documents
-- ============================================================
INSERT INTO sop_templates (id, name, description, html_content, variables, is_active, created_by) VALUES
  (1, 'Standard Offshore Consultant SOP', 'Default statement of purpose issued to offshore delivery staff.',
   '<h2>Statement of Purpose</h2><p>This confirms the engagement of {{name}} as {{role}} on the {{project}} workstream at a billing rate of {{rate}} USD per hour, effective {{start_date}}.</p><p>Working hours follow the India delivery calendar. Timesheets are submitted fortnightly through the VCC Timesheet portal.</p>',
   '["name","role","project","rate","start_date"]'::jsonb, true, 'ADM001'),
  (2, 'Onsite Consultant SOP (USA)', 'Issued to consultants deployed at the Savannah and Houston sites.',
   '<h2>Statement of Purpose — Onsite</h2><p>{{name}} is engaged as {{role}} on {{project}}, based onsite, at {{rate}} USD per hour from {{start_date}}.</p><p>Onsite staff follow the US holiday calendar and the client site access policy.</p>',
   '["name","role","project","rate","start_date"]'::jsonb, true, 'ADM001')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('sop_templates', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM sop_templates), 1));

INSERT INTO sop_documents (
  template_id, user_id, role, hourly_rate, rendered_html, status,
  sent_to_email, sent_at, approved_at, approval_token, created_by
)
SELECT
  CASE WHEN sr.location = 'Onsite' THEN 2 ELSE 1 END,
  u.id, u.designation, COALESCE(NULLIF(sr.rate, 0), 35),
  '<h2>Statement of Purpose</h2><p>This confirms the engagement of ' || u.name ||
    ' as ' || COALESCE(u.designation, 'Consultant') || ' on the ' || COALESCE(u.project, 'VCC') ||
    ' workstream at a billing rate of ' || COALESCE(NULLIF(sr.rate, 0), 35) || ' USD per hour.</p>',
  CASE WHEN (('x' || substr(md5(u.id || 'sop'), 1, 8))::bit(32)::bigint) % 3 = 0 THEN 'sent' ELSE 'approved' END,
  u.email, '2026-06-01T09:00:00Z',
  CASE WHEN (('x' || substr(md5(u.id || 'sop'), 1, 8))::bit(32)::bigint) % 3 <> 0 THEN '2026-06-03T11:00:00Z'::timestamptz END,
  'demo-token-' || u.id,
  'ADM001'
FROM users u
JOIN sow_resources sr ON lower(trim(sr.name)) = lower(trim(u.name))
WHERE u.is_active AND u.role IN ('employee', 'manager')
ON CONFLICT (approval_token) DO NOTHING;


-- ============================================================
-- DOCUMENTS — one offer letter + one contract per active employee
-- ============================================================
INSERT INTO documents (user_id, doc_type, original_name, stored_name, file_size, mime_type, uploaded_by, uploaded_at)
SELECT
  u.id, dt.t,
  initcap(replace(dt.t, '_', ' ')) || ' - ' || u.name || '.pdf',
  'demo/' || u.id || '/' || dt.t || '.pdf',
  180000 + ((('x' || substr(md5(u.id || dt.t), 1, 8))::bit(32)::bigint) % 400000),
  'application/pdf', 'ADM001', COALESCE(u.start_date, DATE '2025-01-10') + 14
FROM users u
CROSS JOIN (VALUES ('offer_letter'), ('contract')) AS dt(t)
WHERE u.is_active AND u.role IN ('employee', 'manager')
  AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.user_id = u.id AND d.doc_type = dt.t);


-- ============================================================
-- HIRING — more open requirements and referrals
-- ============================================================
INSERT INTO requirements (title, description, project, location_type, location_detail, positions_count, skills, priority, status, created_by, created_at, updated_at) VALUES
  ('D365 F&O Technical Consultant', 'X++ developer for the finance and operations workstream.', 'VCC - D365 FO', 'offshore', 'Chennai, India', 2, 'D365 FO, X++, Azure DevOps', 'high', 'open', 'ADM001', '2026-06-12', '2026-06-12'),
  ('EDI Analyst', 'EDI mapping and trading partner onboarding.', 'VCC - JDE & EDI', 'offshore', 'Pune, India', 1, 'EDI, X12, JDE, Gentran', 'medium', 'in_progress', 'ADM001', '2026-06-20', '2026-07-14'),
  ('Cloud Operations Engineer', '24x7 AWS operations and incident response.', 'VCC - IT Infra Onsite', 'onsite', 'Savannah, GA', 2, 'AWS, Terraform, PagerDuty, Linux', 'urgent', 'open', 'ADM001', '2026-07-02', '2026-07-02'),
  ('Salesforce QA Engineer', 'Regression automation for the CPQ and Service Cloud suites.', 'VCC - QA QC', 'offshore', 'Bangalore, India', 2, 'Selenium, Provar, Salesforce, CI/CD', 'high', 'open', 'ADM001', '2026-07-15', '2026-07-15'),
  ('Technical Program Manager', 'Cross-workstream delivery governance.', 'VCC - Projects PMO', 'hybrid', 'Savannah, GA / Remote', 1, 'Agile, SAFe, Stakeholder management', 'medium', 'on_hold', 'ADM001', '2026-05-28', '2026-07-01')
ON CONFLICT DO NOTHING;

INSERT INTO referrals (requirement_id, candidate_name, candidate_email, candidate_phone, referred_by, referred_by_name, notes, status, created_at)
SELECT r.id, c.nm, c.em, c.ph, u.id, u.name, c.nt, c.st, c.dt::timestamptz
FROM (VALUES
  ('D365 F&O Technical Consultant', 'Suresh Iyer',      'suresh.iyer@example.com',    '+91-9812345673', '100530', 'Strong X++ background, 7 years on F&O.',            'shortlisted', '2026-06-25T10:00:00Z'),
  ('D365 F&O Technical Consultant', 'Priyanka Bose',    'priyanka.bose@example.com',  '+91-9812345674', '100617', 'Ex-Infosys, D365 finance modules.',                 'submitted',   '2026-07-01T09:20:00Z'),
  ('Cloud Operations Engineer',     'Daniel Okafor',    'daniel.okafor@example.com',  '+1-4045550119',  '100070', 'AWS certified, currently onsite in Atlanta.',       'interviewing','2026-07-08T15:45:00Z'),
  ('Salesforce QA Engineer',        'Anjali Nair',      'anjali.nair@example.com',    '+91-9812345675', '100459', 'Provar and Selenium, 4 years Salesforce QA.',       'submitted',   '2026-07-20T11:10:00Z'),
  ('EDI Analyst',                   'Ramesh Subramani', 'ramesh.s@example.com',       '+91-9812345676', '100464', 'Gentran and X12 mapping, JDE integration exposure.', 'hired',       '2026-06-30T08:30:00Z')
) AS c(req_title, nm, em, ph, ref_by, nt, st, dt)
JOIN requirements r ON r.title = c.req_title
JOIN users u ON u.id = c.ref_by
WHERE NOT EXISTS (SELECT 1 FROM referrals x WHERE x.candidate_name = c.nm);


-- ============================================================
-- AUDIT LOG — recent activity so the audit screen is not blank
-- ============================================================
INSERT INTO audit_logs (user_id, user_name, user_role, action, target_type, target_id, details, created_at)
SELECT
  a.uid, a.unm, a.urole, a.action, a.ttype, a.tid, a.det::jsonb,
  (DATE '2026-08-07' - (a.days_ago || ' days')::interval) + (a.hrs || ' hours')::interval
FROM (VALUES
  ('200048','Kishan Vasant','admin','email_login','user','200048','{"email":"kishan@d4insight.com","role":"admin"}', 0, 8),
  ('200048','Kishan Vasant','admin','view_salaries','salary',NULL,'{"count":107}', 0, 9),
  ('FIN001','Finance Lead','finance','update_invoice','invoice','3','{"status":"sent"}', 1, 14),
  ('200048','Kishan Vasant','admin','update_user','user','100617','{"changed":["hourly_rate"],"from":37,"to":39}', 2, 11),
  ('FIN001','Finance Lead','finance','export_salaries','salary',NULL,'{"format":"xlsx","rows":107}', 3, 16),
  ('CLI002','Client Manager','client','approve_timesheets','timesheet',NULL,'{"period":"Jul 6 - Jul 19, 2026","count":68}', 4, 10),
  ('200048','Kishan Vasant','admin','create_user','user','100688','{"name":"Arun Joseph Arulsekar"}', 6, 12),
  ('CLI001','Client Finance','client','approve_sow','sow','2','{"sow_number":"SOW-2026-0006"}', 7, 15),
  ('200048','Kishan Vasant','admin','login_failed','user','ADM001','{"reason":"wrong_password"}', 8, 7),
  ('FIN001','Finance Lead','finance','create_invoice','invoice','5','{"amount":184320}', 9, 13),
  ('200048','Kishan Vasant','admin','freeze_period','timesheet',NULL,'{"period":"Jun 22 - Jul 5, 2026"}', 12, 17),
  ('CLI002','Client Manager','client','reject_sow','sow','11','{"reason":"Budget deferred"}', 20, 14)
) AS a(uid, unm, urole, action, ttype, tid, det, days_ago, hrs)
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'view_salaries');


-- ============================================================
-- Integration config + SharePoint field map (admin settings screens)
-- ============================================================
INSERT INTO integration_config (provider, config, is_active, updated_by) VALUES
  ('sharepoint', '{"site":"visualcomfort.sharepoint.com","list":"Timesheets","sync":"every 15 min"}'::jsonb, true,  'ADM001'),
  ('teams',      '{"channel":"VCC Delivery","reminders":"weekdays 09:00 IST"}'::jsonb,                       true,  'ADM001'),
  ('docusign',   '{"account":"demo","base_url":"https://demo.docusign.net/restapi"}'::jsonb,                 false, 'ADM001')
ON CONFLICT (provider) DO NOTHING;

INSERT INTO sharepoint_field_mapping (sharepoint_field, local_field, transform, is_active)
SELECT * FROM (VALUES
  ('Title',        'user_name',   NULL,        true),
  ('EmployeeID',   'user_id',     NULL,        true),
  ('WorkDate',     'date',        'to_date',   true),
  ('HoursWorked',  'hours',       'to_number', true),
  ('ProjectName',  'work_item',   NULL,        true),
  ('Notes',        'description', NULL,        true)
) AS v(a, b, c, d)
WHERE NOT EXISTS (SELECT 1 FROM sharepoint_field_mapping);

INSERT INTO sharepoint_sync_log (sync_type, status, items_synced, items_failed, started_at, completed_at)
SELECT * FROM (VALUES
  ('incremental', 'completed', 412, 0, '2026-08-07T02:15:00Z'::timestamptz, '2026-08-07T02:16:40Z'::timestamptz),
  ('incremental', 'completed', 388, 2, '2026-08-06T02:15:00Z'::timestamptz, '2026-08-06T02:17:05Z'::timestamptz),
  ('full',        'completed', 5820, 0, '2026-08-01T01:00:00Z'::timestamptz, '2026-08-01T01:22:14Z'::timestamptz)
) AS v(a, b, c, d, e, f)
WHERE NOT EXISTS (SELECT 1 FROM sharepoint_sync_log);

-- ############################################################
-- # demo passwords
-- #
-- # One shared password per role, so a walkthrough can sign in as
-- # anyone. PBKDF2-SHA256 / 100000 iterations, matching
-- # src/lib/password.js. Change them from the admin UI, or edit
-- # PASSWORDS in supabase/_build/build-seed.mjs and regenerate.
-- #
-- # These are demo credentials in a public git history. They are not
-- # secrets and must be rotated before this database holds real data.
-- ############################################################

-- admin: Admin@2026
UPDATE users SET password_hash = 'pbkdf2:100000:b0f6c18967ec648a496def93cf1c4e4c:3782ef931fbc4e4c5959e9f5d1f0ca4c643b6d67d98eeba9df78f7df48b29dfe'
WHERE role = 'admin' AND password_hash IS NULL;

-- manager: Manager@2026
UPDATE users SET password_hash = 'pbkdf2:100000:5f97dcc7d567966df0eda4e6be9d1657:0f8ad209b0f253b1d004b149b6fb5e6d246ed6388d8fe2d5a3a95ff275d44d4d'
WHERE role = 'manager' AND password_hash IS NULL;

-- finance: Finance@2026
UPDATE users SET password_hash = 'pbkdf2:100000:dd2b16af67bfb0b462acf39b0a4b2a6d:fa8c05b65c3561db4016df351290d1204767d6b95798bbfc2208ad65fa84fffd'
WHERE role = 'finance' AND password_hash IS NULL;

-- employee: Employee@2026
UPDATE users SET password_hash = 'pbkdf2:100000:071365a1fcdf50934876f9ff57285032:3da9641e98878e551aa458ea430ea8c675e676c34a7cfcdc1419b5f669b8dc8d'
WHERE role IN ('employee', 'consultant') AND password_hash IS NULL;

COMMIT;
