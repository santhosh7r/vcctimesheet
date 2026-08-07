-- ============================================================
-- VCC Timesheet App — Supabase Postgres Schema
-- Run this in Supabase SQL Editor to create all tables
-- ============================================================

-- ── USERS ──
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'admin')),
  designation TEXT,
  project TEXT,
  start_date DATE,
  end_date DATE,
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  email TEXT,
  phone TEXT,
  auth_id UUID REFERENCES auth.users(id),
  m365_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TIMESHEETS ──
CREATE TABLE IF NOT EXISTS timesheets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT,
  user_project TEXT,
  period_label TEXT NOT NULL,
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'submitted', 'approved', 'rejected')),
  total_hours NUMERIC(8,2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  sharepoint_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_label)
);

-- ── TIMESHEET ENTRIES ──
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id BIGSERIAL PRIMARY KEY,
  timesheet_id BIGINT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_name TEXT,
  work_item TEXT,
  description TEXT,
  hours NUMERIC(5,2) DEFAULT 0,
  sharepoint_item_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(timesheet_id, date)
);

-- ── FROZEN PERIODS ──
CREATE TABLE IF NOT EXISTS frozen_periods (
  id BIGSERIAL PRIMARY KEY,
  period_label TEXT NOT NULL,
  project TEXT,
  frozen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── LEAVE BALANCES ──
CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_days INTEGER DEFAULT 0,
  used_days INTEGER DEFAULT 0,
  UNIQUE(user_id, leave_type, year)
);

-- ── LEAVES ──
CREATE TABLE IF NOT EXISTS leaves (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TASKS ──
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT,
  assigned_by TEXT REFERENCES users(id),
  assigned_by_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENTS ──
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('offer_letter', 'sow', 'contract', 'id_proof', 'other', 'sop')),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  storage_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REQUIREMENTS (Hiring) ──
CREATE TABLE IF NOT EXISTS requirements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project TEXT,
  location_type TEXT CHECK (location_type IN ('onsite', 'offshore', 'hybrid', 'remote')),
  location_detail TEXT,
  positions_count INTEGER DEFAULT 1,
  skills TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'on_hold')),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEETINGS ──
CREATE TABLE IF NOT EXISTS meetings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  attendees JSONB DEFAULT '[]',
  notes TEXT,
  project TEXT,
  created_by TEXT REFERENCES users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEETING ACTIONS ──
CREATE TABLE IF NOT EXISTS meeting_actions (
  id BIGSERIAL PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to TEXT REFERENCES users(id),
  assigned_to_name TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALES DEALS ──
CREATE TABLE IF NOT EXISTS sales_deals (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  client_name TEXT,
  deal_value NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  stage TEXT DEFAULT 'prospect' CHECK (stage IN ('prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  owner_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALES ACTIVITIES ──
CREATE TABLE IF NOT EXISTS sales_activities (
  id BIGSERIAL PRIMARY KEY,
  deal_id BIGINT NOT NULL REFERENCES sales_deals(id) ON DELETE CASCADE,
  activity_type TEXT,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NINEBOX PLACEMENTS ──
CREATE TABLE IF NOT EXISTS ninebox_placements (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT,
  hourly_rate NUMERIC(10,2),
  project TEXT,
  potential TEXT CHECK (potential IN ('low', 'medium', 'high')),
  performance TEXT CHECK (performance IN ('low', 'medium', 'high')),
  period TEXT,
  notes TEXT,
  placed_by TEXT REFERENCES users(id),
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period)
);

-- ── KPI SCORES ──
CREATE TABLE IF NOT EXISTS kpi_scores (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  period TEXT NOT NULL,
  score NUMERIC(5,2),
  category TEXT,
  notes TEXT,
  scored_by TEXT REFERENCES users(id),
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- NEW TABLES for Production Features
-- ══════════════════════════════════════════════

-- ── SOP TEMPLATES ──
CREATE TABLE IF NOT EXISTS sop_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SOP DOCUMENTS ──
CREATE TABLE IF NOT EXISTS sop_documents (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT REFERENCES sop_templates(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT,
  hourly_rate NUMERIC(10,2),
  rendered_html TEXT,
  pdf_storage_path TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  sent_to_email TEXT,
  sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_token TEXT UNIQUE,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SHAREPOINT SYNC LOG ──
CREATE TABLE IF NOT EXISTS sharepoint_sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT DEFAULT 'incremental',
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  items_synced INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── SHAREPOINT FIELD MAPPING ──
CREATE TABLE IF NOT EXISTS sharepoint_field_mapping (
  id BIGSERIAL PRIMARY KEY,
  sharepoint_field TEXT NOT NULL,
  local_field TEXT NOT NULL,
  transform TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATION SCHEDULE ──
CREATE TABLE IF NOT EXISTS notification_schedule (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  notification_type TEXT NOT NULL,
  channel TEXT DEFAULT 'teams' CHECK (channel IN ('teams', 'email', 'both')),
  message TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONSOLIDATION REPORTS ──
CREATE TABLE IF NOT EXISTS consolidation_reports (
  id BIGSERIAL PRIMARY KEY,
  report_type TEXT NOT NULL,
  period TEXT,
  data JSONB,
  pdf_storage_path TEXT,
  emailed_to JSONB DEFAULT '[]',
  generated_by TEXT REFERENCES users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INTEGRATION CONFIG ──
CREATE TABLE IF NOT EXISTS integration_config (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_period ON timesheets(period_label);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet ON timesheet_entries(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_leaves_user_id ON leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_meeting ON meeting_actions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_deal ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_ninebox_period ON ninebox_placements(period);
CREATE INDEX IF NOT EXISTS idx_notification_schedule_user ON notification_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_documents_user ON sop_documents(user_id);

-- ══════════════════════════════════════════════
-- RPC FUNCTIONS (for Reports)
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_timesheet_summary(p_period TEXT DEFAULT NULL)
RETURNS TABLE(
  project TEXT,
  employee_count BIGINT,
  submitted_count BIGINT,
  total_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(u.project, 'Unassigned') AS project,
    COUNT(DISTINCT u.id) AS employee_count,
    COUNT(DISTINCT CASE WHEN t.status = 'submitted' THEN t.id END) AS submitted_count,
    COALESCE(SUM(te.hours), 0) AS total_hours
  FROM users u
  LEFT JOIN timesheets t ON t.user_id = u.id
    AND (p_period IS NULL OR t.period_label = p_period)
  LEFT JOIN timesheet_entries te ON te.timesheet_id = t.id
  WHERE u.is_active = TRUE AND u.role = 'employee'
  GROUP BY u.project;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_leave_summary()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'by_type', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT leave_type, SUM(days_count) AS total_days, COUNT(*) AS count
        FROM leaves WHERE status = 'approved'
        GROUP BY leave_type
      ) t
    ),
    'by_employee', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT user_id, user_name, SUM(days_count) AS total_days
        FROM leaves WHERE status = 'approved'
        GROUP BY user_id, user_name
        ORDER BY total_days DESC
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE frozen_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ninebox_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharepoint_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_config ENABLE ROW LEVEL SECURITY;

-- Helper to get current user's app role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_app_id()
RETURNS TEXT AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── USERS RLS ──
CREATE POLICY "Users can view all active users" ON users
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Consolidators can manage users" ON users
  FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = get_user_app_id());

-- ── TIMESHEETS RLS ──
CREATE POLICY "Employees see own timesheets" ON timesheets
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Employees manage own timesheets" ON timesheets
  FOR INSERT WITH CHECK (user_id = get_user_app_id());
CREATE POLICY "Employees update own timesheets" ON timesheets
  FOR UPDATE USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));

-- ── TIMESHEET ENTRIES RLS ──
CREATE POLICY "Entries follow timesheet access" ON timesheet_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
      AND (t.user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'))
    )
  );

-- ── LEAVES RLS ──
CREATE POLICY "Employees see own leaves" ON leaves
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Employees create own leaves" ON leaves
  FOR INSERT WITH CHECK (user_id = get_user_app_id());
CREATE POLICY "Managers approve leaves" ON leaves
  FOR UPDATE USING (get_user_role() IN ('manager', 'admin'));

-- ── LEAVE BALANCES RLS ──
CREATE POLICY "Employees see own balances" ON leave_balances
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Admins manage balances" ON leave_balances
  FOR ALL USING (get_user_role() = 'admin');

-- ── TASKS RLS ──
CREATE POLICY "Users see relevant tasks" ON tasks
  FOR SELECT USING (
    user_id = get_user_app_id()
    OR assigned_by = get_user_app_id()
    OR get_user_role() IN ('manager', 'admin')
  );
CREATE POLICY "Managers create tasks" ON tasks
  FOR INSERT WITH CHECK (get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Task participants update" ON tasks
  FOR UPDATE USING (
    user_id = get_user_app_id()
    OR assigned_by = get_user_app_id()
    OR get_user_role() IN ('manager', 'admin')
  );
CREATE POLICY "Managers delete tasks" ON tasks
  FOR DELETE USING (get_user_role() IN ('manager', 'admin'));

-- ── DOCUMENTS RLS ──
CREATE POLICY "Users see own docs" ON documents
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Upload docs" ON documents
  FOR INSERT WITH CHECK (get_user_role() IN ('manager', 'admin') OR user_id = get_user_app_id());
CREATE POLICY "Delete docs" ON documents
  FOR DELETE USING (get_user_role() = 'admin');

-- ── Read-all policies for admin-level tables ──
CREATE POLICY "All can read frozen periods" ON frozen_periods FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage frozen periods" ON frozen_periods FOR ALL USING (get_user_role() IN ('manager', 'admin'));

CREATE POLICY "All can read requirements" ON requirements FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage requirements" ON requirements FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "All can read meetings" ON meetings FOR SELECT USING (TRUE);
CREATE POLICY "Managers manage meetings" ON meetings FOR ALL USING (get_user_role() IN ('manager', 'admin'));

CREATE POLICY "All can read meeting actions" ON meeting_actions FOR SELECT USING (TRUE);
CREATE POLICY "Managers manage meeting actions" ON meeting_actions FOR ALL USING (get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Assignees update meeting actions" ON meeting_actions FOR UPDATE USING (assigned_to = get_user_app_id());

CREATE POLICY "All can read sales deals" ON sales_deals FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage sales deals" ON sales_deals FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "All can read sales activities" ON sales_activities FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage sales activities" ON sales_activities FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "All can read ninebox" ON ninebox_placements FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage ninebox" ON ninebox_placements FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "All can read kpi scores" ON kpi_scores FOR SELECT USING (TRUE);
CREATE POLICY "Managers manage kpi scores" ON kpi_scores FOR ALL USING (get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins read sop templates" ON sop_templates FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Admins manage sop templates" ON sop_templates FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Admins read sop documents" ON sop_documents FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Admins manage sop documents" ON sop_documents FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Admins read sync log" ON sharepoint_sync_log FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Admins read notifications" ON notification_schedule FOR SELECT USING (get_user_role() IN ('manager', 'admin'));
CREATE POLICY "Admins read reports" ON consolidation_reports FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Admins read integration config" ON integration_config FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Admins manage integration config" ON integration_config FOR ALL USING (get_user_role() = 'admin');
