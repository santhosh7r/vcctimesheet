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
