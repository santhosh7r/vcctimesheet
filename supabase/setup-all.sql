-- ============================================================
-- VCC Timesheet App — complete database setup
--
-- GENERATED FILE. Do not edit by hand.
-- Regenerate with: node supabase/_build/build-setup.mjs
--
-- Paste the whole thing into the Supabase SQL Editor and run ONCE,
-- on a NEW project. Then run supabase/seed-demo.sql for demo data.
--
-- NOT safe to re-run against a database in use. migration-006 is a
-- destructive reset: it deletes all users, timesheets, leaves and
-- 9-box placements before re-inserting the roster. A guard at the top
-- aborts the script if any timesheet or leave rows already exist, so
-- a stray re-run fails loudly instead of discarding data.
-- ============================================================


-- ############################################################
-- # _build/guard.sql
-- ############################################################

-- ============================================================
-- Destructive-run guard. Must stay first in setup-all.sql.
--
-- migration-006-all-employees.sql performs a deliberate reset: it drops
-- every FK referencing users, then DELETEs users, timesheets,
-- timesheet_entries, leaves, leave_balances and ninebox_placements
-- before re-inserting the 69-person roster.
--
-- That is correct on a fresh database and catastrophic on a live one --
-- a second run silently discards every timesheet and leave request
-- entered since the first. So: refuse to run if the database already
-- holds activity, and say why.
--
-- To deliberately wipe and rebuild, drop the data first:
--   TRUNCATE timesheets CASCADE;
-- ...then re-run this script.
--
-- The checks are dynamic (EXECUTE) because on a genuinely fresh
-- database these tables do not exist yet and static SQL inside plpgsql
-- would fail to parse.
-- ============================================================

DO $$
DECLARE
  n BIGINT;
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['timesheets', 'leaves'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('SELECT count(*) FROM public.%I', tbl) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION
          'setup-all.sql refuses to run: public.% already has % row(s).'
          '  This script performs a destructive reset (migration-006 deletes'
          ' all users, timesheets, timesheet_entries, leaves, leave_balances'
          ' and ninebox_placements) and would discard that data.'
          '  It is meant to be run ONCE on a new project.'
          '  See SETUP.md.',
          tbl, n;
      END IF;
    END IF;
  END LOOP;
END $$;


-- ############################################################
-- # schema.sql
-- ############################################################

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
DROP POLICY IF EXISTS "Users can view all active users" ON users;
CREATE POLICY "Users can view all active users" ON users
  FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Consolidators can manage users" ON users;
CREATE POLICY "Consolidators can manage users" ON users
  FOR ALL USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = get_user_app_id());

-- ── TIMESHEETS RLS ──
DROP POLICY IF EXISTS "Employees see own timesheets" ON timesheets;
CREATE POLICY "Employees see own timesheets" ON timesheets
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Employees manage own timesheets" ON timesheets;
CREATE POLICY "Employees manage own timesheets" ON timesheets
  FOR INSERT WITH CHECK (user_id = get_user_app_id());
DROP POLICY IF EXISTS "Employees update own timesheets" ON timesheets;
CREATE POLICY "Employees update own timesheets" ON timesheets
  FOR UPDATE USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));

-- ── TIMESHEET ENTRIES RLS ──
DROP POLICY IF EXISTS "Entries follow timesheet access" ON timesheet_entries;
CREATE POLICY "Entries follow timesheet access" ON timesheet_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
      AND (t.user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'))
    )
  );

-- ── LEAVES RLS ──
DROP POLICY IF EXISTS "Employees see own leaves" ON leaves;
CREATE POLICY "Employees see own leaves" ON leaves
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Employees create own leaves" ON leaves;
CREATE POLICY "Employees create own leaves" ON leaves
  FOR INSERT WITH CHECK (user_id = get_user_app_id());
DROP POLICY IF EXISTS "Managers approve leaves" ON leaves;
CREATE POLICY "Managers approve leaves" ON leaves
  FOR UPDATE USING (get_user_role() IN ('manager', 'admin'));

-- ── LEAVE BALANCES RLS ──
DROP POLICY IF EXISTS "Employees see own balances" ON leave_balances;
CREATE POLICY "Employees see own balances" ON leave_balances
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Admins manage balances" ON leave_balances;
CREATE POLICY "Admins manage balances" ON leave_balances
  FOR ALL USING (get_user_role() = 'admin');

-- ── TASKS RLS ──
DROP POLICY IF EXISTS "Users see relevant tasks" ON tasks;
CREATE POLICY "Users see relevant tasks" ON tasks
  FOR SELECT USING (
    user_id = get_user_app_id()
    OR assigned_by = get_user_app_id()
    OR get_user_role() IN ('manager', 'admin')
  );
DROP POLICY IF EXISTS "Managers create tasks" ON tasks;
CREATE POLICY "Managers create tasks" ON tasks
  FOR INSERT WITH CHECK (get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Task participants update" ON tasks;
CREATE POLICY "Task participants update" ON tasks
  FOR UPDATE USING (
    user_id = get_user_app_id()
    OR assigned_by = get_user_app_id()
    OR get_user_role() IN ('manager', 'admin')
  );
DROP POLICY IF EXISTS "Managers delete tasks" ON tasks;
CREATE POLICY "Managers delete tasks" ON tasks
  FOR DELETE USING (get_user_role() IN ('manager', 'admin'));

-- ── DOCUMENTS RLS ──
DROP POLICY IF EXISTS "Users see own docs" ON documents;
CREATE POLICY "Users see own docs" ON documents
  FOR SELECT USING (user_id = get_user_app_id() OR get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Upload docs" ON documents;
CREATE POLICY "Upload docs" ON documents
  FOR INSERT WITH CHECK (get_user_role() IN ('manager', 'admin') OR user_id = get_user_app_id());
DROP POLICY IF EXISTS "Delete docs" ON documents;
CREATE POLICY "Delete docs" ON documents
  FOR DELETE USING (get_user_role() = 'admin');

-- ── Read-all policies for admin-level tables ──
DROP POLICY IF EXISTS "All can read frozen periods" ON frozen_periods;
CREATE POLICY "All can read frozen periods" ON frozen_periods FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins manage frozen periods" ON frozen_periods;
CREATE POLICY "Admins manage frozen periods" ON frozen_periods FOR ALL USING (get_user_role() IN ('manager', 'admin'));

DROP POLICY IF EXISTS "All can read requirements" ON requirements;

CREATE POLICY "All can read requirements" ON requirements FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins manage requirements" ON requirements;
CREATE POLICY "Admins manage requirements" ON requirements FOR ALL USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "All can read meetings" ON meetings;

CREATE POLICY "All can read meetings" ON meetings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Managers manage meetings" ON meetings;
CREATE POLICY "Managers manage meetings" ON meetings FOR ALL USING (get_user_role() IN ('manager', 'admin'));

DROP POLICY IF EXISTS "All can read meeting actions" ON meeting_actions;

CREATE POLICY "All can read meeting actions" ON meeting_actions FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Managers manage meeting actions" ON meeting_actions;
CREATE POLICY "Managers manage meeting actions" ON meeting_actions FOR ALL USING (get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Assignees update meeting actions" ON meeting_actions;
CREATE POLICY "Assignees update meeting actions" ON meeting_actions FOR UPDATE USING (assigned_to = get_user_app_id());

DROP POLICY IF EXISTS "All can read sales deals" ON sales_deals;

CREATE POLICY "All can read sales deals" ON sales_deals FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins manage sales deals" ON sales_deals;
CREATE POLICY "Admins manage sales deals" ON sales_deals FOR ALL USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "All can read sales activities" ON sales_activities;

CREATE POLICY "All can read sales activities" ON sales_activities FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins manage sales activities" ON sales_activities;
CREATE POLICY "Admins manage sales activities" ON sales_activities FOR ALL USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "All can read ninebox" ON ninebox_placements;

CREATE POLICY "All can read ninebox" ON ninebox_placements FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins manage ninebox" ON ninebox_placements;
CREATE POLICY "Admins manage ninebox" ON ninebox_placements FOR ALL USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "All can read kpi scores" ON kpi_scores;

CREATE POLICY "All can read kpi scores" ON kpi_scores FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Managers manage kpi scores" ON kpi_scores;
CREATE POLICY "Managers manage kpi scores" ON kpi_scores FOR ALL USING (get_user_role() IN ('manager', 'admin'));

DROP POLICY IF EXISTS "Admins read sop templates" ON sop_templates;

CREATE POLICY "Admins read sop templates" ON sop_templates FOR SELECT USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins manage sop templates" ON sop_templates;
CREATE POLICY "Admins manage sop templates" ON sop_templates FOR ALL USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admins read sop documents" ON sop_documents;

CREATE POLICY "Admins read sop documents" ON sop_documents FOR SELECT USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins manage sop documents" ON sop_documents;
CREATE POLICY "Admins manage sop documents" ON sop_documents FOR ALL USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admins read sync log" ON sharepoint_sync_log;

CREATE POLICY "Admins read sync log" ON sharepoint_sync_log FOR SELECT USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins read notifications" ON notification_schedule;
CREATE POLICY "Admins read notifications" ON notification_schedule FOR SELECT USING (get_user_role() IN ('manager', 'admin'));
DROP POLICY IF EXISTS "Admins read reports" ON consolidation_reports;
CREATE POLICY "Admins read reports" ON consolidation_reports FOR SELECT USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins read integration config" ON integration_config;
CREATE POLICY "Admins read integration config" ON integration_config FOR SELECT USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins manage integration config" ON integration_config;
CREATE POLICY "Admins manage integration config" ON integration_config FOR ALL USING (get_user_role() = 'admin');


-- ############################################################
-- # migration-001.sql
-- ############################################################

-- Migration 001: Add missing columns and constraints for SharePoint sync
-- Run this in Supabase SQL Editor if you already ran schema.sql

-- Add total_hours and submitted_at to timesheets
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS total_hours NUMERIC(8,2) DEFAULT 0;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Add unique constraint on timesheet_entries for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timesheet_entries_timesheet_id_date_key'
  ) THEN
    ALTER TABLE timesheet_entries ADD CONSTRAINT timesheet_entries_timesheet_id_date_key UNIQUE (timesheet_id, date);
  END IF;
END $$;

-- Add the SharePoint employee (Krupa Pankaj Vyas)
INSERT INTO users (id, name, role, designation, project, start_date, end_date, hourly_rate, is_active, email, phone)
VALUES ('100048', 'Krupa Pankaj Vyas', 'employee', 'Employee', 'VCC - D365 FO', '2025-01-10', '2026-12-31', 35, TRUE, 'krupa.vyas@d4insight.com', '+91-9876543223')
ON CONFLICT (id) DO NOTHING;

-- Add leave balances for new employee
INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days) VALUES
('100048_casual', '100048', 'casual', 2026, 12, 0),
('100048_sick', '100048', 'sick', 2026, 10, 0),
('100048_earned', '100048', 'earned', 2026, 15, 0)
ON CONFLICT (id) DO NOTHING;


-- ############################################################
-- # migration-002-rls-fix.sql
-- ############################################################

-- Migration 002: Fix RLS for anon key access
-- The app uses its own auth (not Supabase Auth), so we need to allow
-- the anon key to read/write data. The app enforces role-based access
-- in its own API layer (supabaseApi.js).
--
-- Run this in Supabase SQL Editor.

-- Drop existing restrictive policies and replace with open ones
-- (app handles authorization in frontend code)

-- USERS
DROP POLICY IF EXISTS "Users can view all active users" ON users;
DROP POLICY IF EXISTS "Consolidators can manage users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow all access to users" ON users;
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);

-- TIMESHEETS
DROP POLICY IF EXISTS "Employees see own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees manage own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees update own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Allow all access to timesheets" ON timesheets;
CREATE POLICY "Allow all access to timesheets" ON timesheets FOR ALL USING (true) WITH CHECK (true);

-- TIMESHEET ENTRIES
DROP POLICY IF EXISTS "Entries follow timesheet access" ON timesheet_entries;
DROP POLICY IF EXISTS "Allow all access to timesheet_entries" ON timesheet_entries;
CREATE POLICY "Allow all access to timesheet_entries" ON timesheet_entries FOR ALL USING (true) WITH CHECK (true);

-- LEAVES
DROP POLICY IF EXISTS "Employees see own leaves" ON leaves;
DROP POLICY IF EXISTS "Employees create own leaves" ON leaves;
DROP POLICY IF EXISTS "Managers approve leaves" ON leaves;
DROP POLICY IF EXISTS "Allow all access to leaves" ON leaves;
CREATE POLICY "Allow all access to leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);

-- LEAVE BALANCES
DROP POLICY IF EXISTS "Employees see own balances" ON leave_balances;
DROP POLICY IF EXISTS "Admins manage balances" ON leave_balances;
DROP POLICY IF EXISTS "Allow all access to leave_balances" ON leave_balances;
CREATE POLICY "Allow all access to leave_balances" ON leave_balances FOR ALL USING (true) WITH CHECK (true);

-- TASKS
DROP POLICY IF EXISTS "Users see relevant tasks" ON tasks;
DROP POLICY IF EXISTS "Managers create tasks" ON tasks;
DROP POLICY IF EXISTS "Task participants update" ON tasks;
DROP POLICY IF EXISTS "Managers delete tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
CREATE POLICY "Allow all access to tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- DOCUMENTS
DROP POLICY IF EXISTS "Users see own docs" ON documents;
DROP POLICY IF EXISTS "Upload docs" ON documents;
DROP POLICY IF EXISTS "Delete docs" ON documents;
DROP POLICY IF EXISTS "Allow all access to documents" ON documents;
CREATE POLICY "Allow all access to documents" ON documents FOR ALL USING (true) WITH CHECK (true);

-- FROZEN PERIODS
DROP POLICY IF EXISTS "All can read frozen periods" ON frozen_periods;
DROP POLICY IF EXISTS "Admins manage frozen periods" ON frozen_periods;
DROP POLICY IF EXISTS "Allow all access to frozen_periods" ON frozen_periods;
CREATE POLICY "Allow all access to frozen_periods" ON frozen_periods FOR ALL USING (true) WITH CHECK (true);

-- REQUIREMENTS
DROP POLICY IF EXISTS "All can read requirements" ON requirements;
DROP POLICY IF EXISTS "Admins manage requirements" ON requirements;
DROP POLICY IF EXISTS "Allow all access to requirements" ON requirements;
CREATE POLICY "Allow all access to requirements" ON requirements FOR ALL USING (true) WITH CHECK (true);

-- MEETINGS
DROP POLICY IF EXISTS "All can read meetings" ON meetings;
DROP POLICY IF EXISTS "Managers manage meetings" ON meetings;
DROP POLICY IF EXISTS "Allow all access to meetings" ON meetings;
CREATE POLICY "Allow all access to meetings" ON meetings FOR ALL USING (true) WITH CHECK (true);

-- MEETING ACTIONS
DROP POLICY IF EXISTS "All can read meeting actions" ON meeting_actions;
DROP POLICY IF EXISTS "Managers manage meeting actions" ON meeting_actions;
DROP POLICY IF EXISTS "Assignees update meeting actions" ON meeting_actions;
DROP POLICY IF EXISTS "Allow all access to meeting_actions" ON meeting_actions;
CREATE POLICY "Allow all access to meeting_actions" ON meeting_actions FOR ALL USING (true) WITH CHECK (true);

-- SALES DEALS
DROP POLICY IF EXISTS "All can read sales deals" ON sales_deals;
DROP POLICY IF EXISTS "Admins manage sales deals" ON sales_deals;
DROP POLICY IF EXISTS "Allow all access to sales_deals" ON sales_deals;
CREATE POLICY "Allow all access to sales_deals" ON sales_deals FOR ALL USING (true) WITH CHECK (true);

-- SALES ACTIVITIES
DROP POLICY IF EXISTS "All can read sales activities" ON sales_activities;
DROP POLICY IF EXISTS "Admins manage sales activities" ON sales_activities;
DROP POLICY IF EXISTS "Allow all access to sales_activities" ON sales_activities;
CREATE POLICY "Allow all access to sales_activities" ON sales_activities FOR ALL USING (true) WITH CHECK (true);

-- NINEBOX
DROP POLICY IF EXISTS "All can read ninebox" ON ninebox_placements;
DROP POLICY IF EXISTS "Admins manage ninebox" ON ninebox_placements;
DROP POLICY IF EXISTS "Allow all access to ninebox_placements" ON ninebox_placements;
CREATE POLICY "Allow all access to ninebox_placements" ON ninebox_placements FOR ALL USING (true) WITH CHECK (true);

-- KPI SCORES
DROP POLICY IF EXISTS "All can read kpi scores" ON kpi_scores;
DROP POLICY IF EXISTS "Managers manage kpi scores" ON kpi_scores;
DROP POLICY IF EXISTS "Allow all access to kpi_scores" ON kpi_scores;
CREATE POLICY "Allow all access to kpi_scores" ON kpi_scores FOR ALL USING (true) WITH CHECK (true);

-- SOP TEMPLATES
DROP POLICY IF EXISTS "Admins read sop templates" ON sop_templates;
DROP POLICY IF EXISTS "Admins manage sop templates" ON sop_templates;
DROP POLICY IF EXISTS "Allow all access to sop_templates" ON sop_templates;
CREATE POLICY "Allow all access to sop_templates" ON sop_templates FOR ALL USING (true) WITH CHECK (true);

-- SOP DOCUMENTS
DROP POLICY IF EXISTS "Admins read sop documents" ON sop_documents;
DROP POLICY IF EXISTS "Admins manage sop documents" ON sop_documents;
DROP POLICY IF EXISTS "Allow all access to sop_documents" ON sop_documents;
CREATE POLICY "Allow all access to sop_documents" ON sop_documents FOR ALL USING (true) WITH CHECK (true);

-- SHAREPOINT SYNC LOG
DROP POLICY IF EXISTS "Admins read sync log" ON sharepoint_sync_log;
DROP POLICY IF EXISTS "Allow all access to sharepoint_sync_log" ON sharepoint_sync_log;
CREATE POLICY "Allow all access to sharepoint_sync_log" ON sharepoint_sync_log FOR ALL USING (true) WITH CHECK (true);

-- NOTIFICATION SCHEDULE
DROP POLICY IF EXISTS "Admins read notifications" ON notification_schedule;
DROP POLICY IF EXISTS "Allow all access to notification_schedule" ON notification_schedule;
CREATE POLICY "Allow all access to notification_schedule" ON notification_schedule FOR ALL USING (true) WITH CHECK (true);

-- CONSOLIDATION REPORTS
DROP POLICY IF EXISTS "Admins read reports" ON consolidation_reports;
DROP POLICY IF EXISTS "Allow all access to consolidation_reports" ON consolidation_reports;
CREATE POLICY "Allow all access to consolidation_reports" ON consolidation_reports FOR ALL USING (true) WITH CHECK (true);

-- INTEGRATION CONFIG
DROP POLICY IF EXISTS "Admins read integration config" ON integration_config;
DROP POLICY IF EXISTS "Admins manage integration config" ON integration_config;
DROP POLICY IF EXISTS "Allow all access to integration_config" ON integration_config;
CREATE POLICY "Allow all access to integration_config" ON integration_config FOR ALL USING (true) WITH CHECK (true);

-- SHAREPOINT FIELD MAPPING
DROP POLICY IF EXISTS "Allow all access to sharepoint_field_mapping" ON sharepoint_field_mapping;
CREATE POLICY "Allow all access to sharepoint_field_mapping" ON sharepoint_field_mapping FOR ALL USING (true) WITH CHECK (true);


-- ############################################################
-- # migration-003-archived.sql
-- ############################################################

-- Add is_archived column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;


-- ############################################################
-- # migration-004-region.sql
-- ############################################################

ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT DEFAULT '';


-- ############################################################
-- # migration-005-employee-status.sql
-- ############################################################

-- Add employee_status column to users table
-- Values: 'active', 'inactive', 'bench'
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_status TEXT DEFAULT 'active';

-- Backfill from existing is_active / is_archived flags
UPDATE users SET employee_status = CASE
  WHEN is_active = FALSE THEN 'inactive'
  WHEN is_archived = TRUE THEN 'bench'
  ELSE 'active'
END
WHERE employee_status IS NULL OR employee_status = 'active';


-- ############################################################
-- # migration-006-all-employees.sql
-- ############################################################

-- ═══════════════════════════════════════════════════════════════════
-- CLEAN RESET: Remove all users and re-insert 69 correct employees
-- from D4 April 2026 Resource List + admin account
-- Preserves existing timesheets (they reference user_id by TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Ensure employee_status column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_status TEXT DEFAULT 'active';

-- Step 2: Dynamically drop ALL foreign key constraints referencing users table
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
  ) LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- Step 2b: Delete ALL existing data from referencing tables then users
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
  ) LOOP
    EXECUTE format('DELETE FROM %I', r.table_name);
  END LOOP;
END $$;
-- Also delete from tables we know about (in case constraints were already dropped)
DELETE FROM timesheet_entries;
DELETE FROM timesheets;
DELETE FROM leaves;
DELETE FROM leave_balances;
DELETE FROM ninebox_placements;
DELETE FROM users;

-- Step 2c: Re-add foreign key constraints (at end of migration)

-- Step 3: Insert admin account
INSERT INTO users (id, name, role, designation, project, is_active, employee_status)
VALUES ('ADM001', 'Kishore', 'admin', 'Admin', NULL, TRUE, 'active');

-- ═══════════════════════════════════════════════════════════════════
-- Step 4: Insert all 69 employees from resource list
-- ═══════════════════════════════════════════════════════════════════

-- VCC - D365 FO (15)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200001', 'Abhinandhan Poorlin', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'abhinandhan.poorlin@d4insight.com', TRUE, 'active'),
('200002', 'Anant Moger', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'anant.moger@d4insight.com', TRUE, 'active'),
('200003', 'Aravindh Perumal', 'employee', 'Functional Consultant-IT', 'VCC - D365 FO', 'aravindh.perumal@d4insight.com', TRUE, 'active'),
('200004', 'Keerthivasan Vijayagothandaraman', 'employee', 'Functional Consultant-IT', 'VCC - D365 FO', 'keerthi.vasan@d4insight.com', TRUE, 'active'),
('200005', 'Kishore Babu Jyothi', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'kishore.babu@d4insight.com', TRUE, 'active'),
('100048', 'Krupa Sarkar Vyas', 'manager', 'D365 Project Manager-IT', 'VCC - D365 FO', 'krupa.vyas@d4insight.com', TRUE, 'active'),
('200006', 'Manish Dayma', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'manishkumar.dayma@d4insight.com', TRUE, 'active'),
('200007', 'Meenalochini Balachandran', 'employee', 'D365 QA Testing-IT', 'VCC - D365 FO', 'meenalochini.b@d4insight.com', TRUE, 'active'),
('200008', 'Sankar Raman P', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'sankar.raman@d4insight.com', TRUE, 'active'),
('200009', 'Shahul Hameed I', 'employee', 'D365 QA Testing-IT', 'VCC - D365 FO', 'shahulhameed.i@d4insight.com', TRUE, 'active'),
('200010', 'Srinivasan Pandiaraj', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'srinivasan.pandiraj@d4insight.com', TRUE, 'active'),
('200011', 'Aran Thangaraj', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'thangaraj.aran@d4insight.com', TRUE, 'active'),
('200012', 'Boya Narasimha Reddy', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'boyanarasimha.reddy@d4insight.com', TRUE, 'active'),
('20260201001', 'Andrea Solorzano', 'employee', 'D365 Administrator-IT', 'VCC - D365 FO', 'Andrea.solorzano@d4insight.com', TRUE, 'active'),
('200013', 'Bradley Lacey', 'employee', 'Functional Consultant-IT', 'VCC - D365 FO', 'bradley.lacey@d4insight.com', TRUE, 'active');

-- VCC - Enterprise Integration (2)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('100070', 'Pothiraja A', 'employee', 'Senior Technical Program Manager', 'VCC - Enterprise Integration', 'pothi.raja@d4insight.com', TRUE, 'active'),
('200016', 'Rafi Ghafoor', 'employee', 'Product Manager-IT', 'VCC - Enterprise Integration', 'rafi.ghafoor@d4insight.com', TRUE, 'active');

-- VCC - BA - Onsite (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200014', 'Zamir Vahora', 'employee', 'Senior Business Analyst', 'VCC - BA - Onsite', 'zamir.vahora@d4insight.com', TRUE, 'active');

-- VCC - Project Financial Services (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200017', 'Javal Vadera', 'employee', 'VMO Analyst-IT', 'VCC - Project Financial Services', 'javal.vadera@d4insight.com', TRUE, 'active');

-- VCC - IT Support Savannah (2)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200018', 'Akhila Reddy Cherukupalli', 'employee', 'IT Support Specialist', 'VCC - IT Support Savannah', 'akhila.reddy@d4insight.com', TRUE, 'active'),
('20241001001', 'Dhiraj Gurung', 'employee', 'IT Support Specialist', 'VCC - IT Support Savannah', 'dhiraj.gurang@d4insight.com', TRUE, 'active');

-- VCC - IT Infra - 8x8 (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200019', 'Aldrin Shaji', 'employee', '8x8 Specialist', 'VCC - IT Infra - 8x8', 'aldrin.shaji@d4insight.com', TRUE, 'active');

-- VCC - IT Helpdesk Offshore (3)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('100476', 'Senthil Nathan Rajagopal', 'employee', 'IT Helpdesk', 'VCC - IT Helpdesk Offshore', 'senthilnathan.r@d4insight.com', TRUE, 'active'),
('100459', 'Vivekanandan Jeevanantham', 'employee', 'IT Helpdesk', 'VCC - IT Helpdesk Offshore', 'vivekanandan.j@d4insight.com', TRUE, 'active'),
('200020', 'Tilak Gunasekaran', 'employee', 'IT Helpdesk', 'VCC - IT Helpdesk Offshore', 'thilak.g@d4insight.com', TRUE, 'bench');

-- VCC - IT Infra Onsite (3)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200015', 'Anand Suchak', 'employee', 'Project Manager-IT', 'VCC - IT Infra Onsite', 'anand.suchak@d4insight.com', TRUE, 'active'),
('200021', 'Janna Cox', 'employee', 'IT Infrastructure Incident Manager', 'VCC - IT Infra Onsite', 'janna.cox@d4insight.com', TRUE, 'active'),
('200022', 'Mark Soliz', 'employee', 'IT Helpdesk Support', 'VCC - IT Infra Onsite', 'marcos.soliz@d4insight.com', TRUE, 'active');

-- VCC - IT Infra PMO (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('343', 'Janani Ramkumar', 'employee', 'Project Manager-IT', 'VCC - IT Infra PMO', 'janani.ramkumar@d4insight.com', TRUE, 'active');

-- VCC - Projects PMO / Security / Delivery (3)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200023', 'Karthikeyan Vijayan', 'employee', 'Senior Security Consultant-IT', 'VCC - Projects PMO', 'karthikeyan.vijayan@d4insight.com', TRUE, 'active'),
('200024', 'Mohammed Abdullah Khan', 'employee', 'Senior Security Consultant-IT', 'VCC - Projects PMO', 'mohammed.abdullah@d4insight.com', TRUE, 'active'),
('200048', 'Kishan Vasant', 'admin', 'Head-Account Management', 'VCC - Projects PMO', 'kishan@d4insight.com', TRUE, 'active');

-- VCC - JDE & EDI (5)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200025', 'Arul Kumaran Veerattan', 'employee', 'JDE Solution Analyst & Developer', 'VCC - JDE & EDI', 'arul.kumaran@d4insight.com', TRUE, 'active'),
('100659', 'Bholeshankar Pathak', 'employee', 'EDI Specialist III', 'VCC - JDE & EDI', 'bholeshankar.pathak@d4insight.com', TRUE, 'active'),
('200026', 'Chandan Ramkeval Prajapati', 'employee', 'JDE Solution Analyst & Developer', 'VCC - JDE & EDI', 'chandan.ramkeval@d4insight.com', TRUE, 'active'),
('200027', 'Nitin Kumar Pal', 'employee', 'EDI Analyst', 'VCC - JDE & EDI', 'nitinkumar.pal@d4insight.com', TRUE, 'active'),
('200028', 'Tom Bruttell', 'employee', 'JDE Solution Analyst & Developer', 'VCC - JDE & EDI', 'thomas.bruttell@d4insight.com', TRUE, 'active');

-- VCC - Partner Insight (8)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('100464', 'Balaji Padmanaban', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'balaji.padmanaban@d4insight.com', TRUE, 'active'),
('100474', 'Kiran KalavaKollu', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'kiran.kalava@d4insight.com', TRUE, 'active'),
('200029', 'Mahesh Marimuthu', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'mahesh.marimuthu@d4insight.com', TRUE, 'active'),
('100460', 'Muthu Krishnan', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'muthu.k@d4insight.com', TRUE, 'active'),
('200030', 'Nageswara Dhaveji Ch', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'ch.nageswara.dhaveji@d4insight.com', TRUE, 'active'),
('100463', 'Sasikumar Saravanan', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'sasikumar.s@d4insight.com', TRUE, 'active'),
('200031', 'Gayathri Murugadas', 'admin', 'Project Coordinator-IT', 'VCC - Partner Insight', 'gayathri.m@d4insight.com', TRUE, 'active'),
('200032', 'Humera Ahmed', 'employee', 'Full Stack Developer-IT', 'VCC - Partner Insight', 'humera.ahmed@d4insight.com', TRUE, 'active');

-- VCC - QA QC (5)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200033', 'Ganesh Jayaraman', 'employee', 'QA Engineer', 'VCC - QA QC', 'ganesh.jayaraman@d4insight.com', TRUE, 'active'),
('200034', 'Manjari Porkai Pandian', 'employee', 'QA Engineer', 'VCC - QA QC', 'manjari.porkai@d4insight.com', TRUE, 'active'),
('200035', 'Saritha Thotta', 'employee', 'QA Lead', 'VCC - QA QC', 'saritha.thota@d4insight.com', TRUE, 'active'),
('200036', 'Bindu Marella', 'manager', 'Manager-Quality Analyst', 'VCC - QA QC', 'bindu.marella@d4insight.com', TRUE, 'active'),
('100637', 'Arif Mohammed', 'employee', 'QA Performance Testing Lead', 'VCC - QA QC', 'mohammed.arif@d4insight.com', TRUE, 'active');

-- VCC - Salesforce (14)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200037', 'Swaminathan Bhuvanesan', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'swaminathan.b@d4insight.com', TRUE, 'active'),
('111104', 'Divya Priya', 'employee', 'Senior Salesforce Developer', 'VCC - Salesforce', 'divya.priya@d4insight.com', TRUE, 'active'),
('200038', 'Hari Chandana P', 'employee', 'Senior Salesforce Developer', 'VCC - Salesforce', 'hari.chandana@d4insight.com', TRUE, 'active'),
('200039', 'Karthiga Adhimoolam', 'employee', 'Senior Salesforce Developer', 'VCC - Salesforce', 'karthiga.adhimoolam@d4insight.com', TRUE, 'active'),
('100530', 'Mohammed Navazuddin', 'employee', 'Integration Developer', 'VCC - Salesforce', 'mohammed.navazuddin@d4insight.com', TRUE, 'active'),
('100329', 'Naveenkumar Venkatesan', 'employee', 'Salesforce IT Admin', 'VCC - Salesforce', 'naveenkumar.venkatesan@d4insight.com', TRUE, 'active'),
('111103', 'Nishandhini Ashok Kumar', 'employee', 'Senior Technical Program Manager-IT', 'VCC - Salesforce', 'nishandhini.a@d4insight.com', TRUE, 'active'),
('200040', 'Sandhisegaran Munisami', 'manager', 'Technical Project Manager-IT', 'VCC - Salesforce', 'sandhirasegaran.m@d4insight.com', TRUE, 'active'),
('200041', 'Reiyo Christ V', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'reiyo.christ@d4insight.com', TRUE, 'active'),
('200042', 'Dhavan Kumar Reddy S', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'dhavankumar.reddy@d4insight.com', TRUE, 'active'),
('200043', 'Akash Priyadharshan P', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'akash.p@d4insight.com', TRUE, 'active'),
('200044', 'Chintalakonda Rajesh', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'chintalakonda.rajesh@d4insight.com', TRUE, 'active'),
('200045', 'Pratik Parmar', 'employee', 'Project Manager-IT', 'VCC - Salesforce', 'pratik.parmar@d4insight.com', TRUE, 'active'),
('200049', 'Lakshmanan Krishnan', 'employee', 'Salesforce Technical Architect-IT', 'VCC - Salesforce', 'lakshmanan.krishnan@d4insight.com', TRUE, 'active');

-- VCC - Web B2B (5)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200046', 'Aruldoss A', 'employee', 'ECOMM Pod Support-IT', 'VCC - Web B2B', 'aruldoss.a@d4insight.com', TRUE, 'active'),
('100616', 'Jagadeesh Raju', 'employee', 'Backend Developer-IT', 'VCC - Web B2B', 'jagadeesh.raju@d4insight.com', TRUE, 'active'),
('100611', 'Sathishraj Raju', 'employee', 'ECOMM Pod Support-IT', 'VCC - Web B2B', 'sathishraj.raju@d4insight.com', TRUE, 'active'),
('100617', 'Vimal David', 'employee', 'Frontend Developer-IT', 'VCC - Web B2B', 'vimal.david@d4insight.com', TRUE, 'active'),
('200047', 'Anand Kumar Pandy', 'manager', 'AVP-IT Technology', 'VCC - Web B2B', 'anand.pandy@d4insight.com', TRUE, 'active');

-- ═══════════════════════════════════════════════════════════════════
-- Step 5: Seed leave balances for all employees
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days)
SELECT u.id || '_' || t.type, u.id, t.type, 2026,
  CASE t.type WHEN 'casual' THEN 12 WHEN 'sick' THEN 10 WHEN 'earned' THEN 15 END,
  0
FROM users u
CROSS JOIN (VALUES ('casual'), ('sick'), ('earned')) AS t(type)
WHERE u.role IN ('employee', 'manager')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- Step 6: Re-add foreign key constraints (drop first to avoid "already exists")
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_user_id_fkey;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_timesheet_id_fkey;
ALTER TABLE timesheet_entries ADD CONSTRAINT timesheet_entries_timesheet_id_fkey FOREIGN KEY (timesheet_id) REFERENCES timesheets(id);

ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_user_id_fkey;
ALTER TABLE leaves ADD CONSTRAINT leaves_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE leave_balances DROP CONSTRAINT IF EXISTS leave_balances_user_id_fkey;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ninebox_placements DROP CONSTRAINT IF EXISTS ninebox_placements_user_id_fkey;
ALTER TABLE ninebox_placements ADD CONSTRAINT ninebox_placements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);


-- ############################################################
-- # migration-007-meeting-notes.sql
-- ############################################################

-- ═══════════════════════════════════════════════════════════════════
-- AI Meeting Notes: auto-detect Teams meetings, pull transcripts,
-- generate minutes + action items via Claude AI
-- ═══════════════════════════════════════════════════════════════════

-- Meeting notes generated by AI from transcripts
CREATE TABLE IF NOT EXISTS meeting_notes_ai (
  id BIGSERIAL PRIMARY KEY,
  -- Source meeting info (from Graph calendar)
  calendar_event_id TEXT UNIQUE,           -- Graph event ID to avoid duplicates
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  meeting_end TIMESTAMPTZ,
  organizer TEXT,                           -- email of organizer
  attendees JSONB DEFAULT '[]',            -- [{email, name}]
  teams_meeting_url TEXT,

  -- Transcript
  transcript_text TEXT,                     -- raw transcript (auto or manually pasted)
  transcript_source TEXT DEFAULT 'manual',  -- 'teams_auto', 'manual', 'upload'

  -- AI-generated content
  summary TEXT,                             -- executive summary
  minutes_html TEXT,                        -- formatted meeting minutes
  key_decisions JSONB DEFAULT '[]',        -- [{decision, context}]
  action_items JSONB DEFAULT '[]',         -- [{task, assignee, due_date, status}]

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcript_ready', 'processing', 'completed', 'failed', 'no_transcript')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron lookups
CREATE INDEX IF NOT EXISTS idx_meeting_notes_ai_status ON meeting_notes_ai(status);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_ai_date ON meeting_notes_ai(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_ai_event ON meeting_notes_ai(calendar_event_id);

-- Action items checklist (normalized for dashboard tracking)
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id BIGSERIAL PRIMARY KEY,
  meeting_note_id BIGINT NOT NULL REFERENCES meeting_notes_ai(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  assignee TEXT,                  -- name or email
  assignee_user_id TEXT,          -- linked user id if matched
  due_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_note ON meeting_action_items(meeting_note_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(status);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee ON meeting_action_items(assignee_user_id);


-- ############################################################
-- # migration-008-finance-role.sql
-- ############################################################

-- Add 'finance' role to the users.role CHECK constraint.
-- Run this in the Supabase SQL editor or via the CLI.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('employee', 'manager', 'admin', 'finance'));


-- ############################################################
-- # migration-009-employee-salaries.sql
-- ############################################################

-- Employee salaries (CTC) — sensitive payroll data.
-- Visible only to admin (admin) and finance roles via RLS.

CREATE TABLE IF NOT EXISTS employee_salaries (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  department TEXT,
  location TEXT,                    -- 'India' | 'USA' | 'UAE' | etc.
  joined_date DATE,
  ctc_amount NUMERIC(14, 2),        -- best-effort parsed amount; may be NULL
  ctc_currency TEXT,                -- 'INR' | 'USD' | 'AED' | NULL
  ctc_period TEXT,                  -- 'annual' | 'hourly' | 'monthly' | 'unknown'
  ctc_raw TEXT,                     -- original spreadsheet text preserved verbatim
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_salaries_location ON employee_salaries (location);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_joined_date ON employee_salaries (joined_date);

-- RLS: only admin (admin) and finance can read/write.
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salaries_select_admin_finance" ON employee_salaries;
CREATE POLICY "salaries_select_admin_finance"
  ON employee_salaries FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "salaries_insert_admin_finance" ON employee_salaries;
CREATE POLICY "salaries_insert_admin_finance"
  ON employee_salaries FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "salaries_update_admin_finance" ON employee_salaries;
CREATE POLICY "salaries_update_admin_finance"
  ON employee_salaries FOR UPDATE
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "salaries_delete_admin" ON employee_salaries;
CREATE POLICY "salaries_delete_admin"
  ON employee_salaries FOR DELETE
  USING (get_user_role() = 'admin');


-- ############################################################
-- # migration-010-finance-billing.sql
-- ############################################################

-- Finance billing data model: clients, billable projects, invoices, invoice line items.
-- Powers the Finance Dashboard's revenue/payout/margin views.
-- Read/write restricted to admin (admin) + finance roles.

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billable_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  billing_type TEXT NOT NULL DEFAULT 'hourly' CHECK (billing_type IN ('hourly', 'monthly_retainer', 'fixed')),
  bill_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billable_projects_client ON billable_projects (client_id);
CREATE INDEX IF NOT EXISTS idx_billable_projects_name ON billable_projects (name);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issue_date DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES billable_projects(id),
  project_name TEXT,
  description TEXT,
  hours NUMERIC(10, 2),
  rate NUMERIC(10, 2),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines (invoice_id);

-- RLS: admin + finance only.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE billable_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'billable_projects', 'invoices', 'invoice_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_finance" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_select_finance" ON %I FOR SELECT USING (get_user_role() IN (''admin'', ''finance''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_finance" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert_finance" ON %I FOR INSERT WITH CHECK (get_user_role() IN (''admin'', ''finance''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_finance" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_update_finance" ON %I FOR UPDATE USING (get_user_role() IN (''admin'', ''finance''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_finance" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete_finance" ON %I FOR DELETE USING (get_user_role() IN (''admin'', ''finance''))', t, t);
  END LOOP;
END $$;


-- ############################################################
-- # migration-011-holidays.sql
-- ############################################################

-- Public holiday calendar — used to exclude non-billable days from
-- revenue calculations and to drive the dashboard's leave/holiday widgets.
-- Readable by all authenticated users; only admin + finance can write.

CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('IN', 'US', 'AE', 'GLOBAL')),
  name TEXT NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date_country ON holidays (holiday_date, country, name);
CREATE INDEX IF NOT EXISTS idx_holidays_country_year ON holidays (country, holiday_date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select_authenticated" ON holidays;
CREATE POLICY "holidays_select_authenticated"
  ON holidays FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "holidays_modify_admin_finance" ON holidays;
CREATE POLICY "holidays_modify_admin_finance"
  ON holidays FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

-- Seed: India + US 2026 holidays.
INSERT INTO holidays (holiday_date, country, name) VALUES
  -- India 2026
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
  -- USA 2026
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
ON CONFLICT DO NOTHING;


-- ############################################################
-- # migration-012-client-role.sql
-- ############################################################

-- Add 'client' role + per-user client linkage and subrole.
-- Client users only ever see data scoped to their client_id; subrole
-- (finance | manager) controls which actions they can take inside a SOW
-- or invoice approval flow.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('employee', 'manager', 'admin', 'finance', 'client'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_subrole TEXT
  CHECK (client_subrole IS NULL OR client_subrole IN ('finance', 'manager'));

CREATE INDEX IF NOT EXISTS idx_users_client_id ON users (client_id) WHERE client_id IS NOT NULL;


-- ############################################################
-- # migration-013-sows.sql
-- ############################################################

-- SOW (Statement of Work) workflow.
-- Lifecycle: draft → submitted_for_finance → finance_approved → sent_for_signature
--            → signed → active (or rejected | cancelled at any point).
-- Visible to: admin/finance always; client_finance + client_manager only for
-- their own client_id.

CREATE TABLE IF NOT EXISTS sows (
  id SERIAL PRIMARY KEY,
  sow_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  project_id TEXT REFERENCES billable_projects(id),
  title TEXT NOT NULL,
  sow_type TEXT NOT NULL DEFAULT 'project' CHECK (sow_type IN ('project', 'resource', 'amendment')),
  description TEXT,
  contract_value NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted_for_finance', 'finance_approved', 'sent_for_signature', 'signed', 'active', 'rejected', 'cancelled')),
  resource_name TEXT,            -- when sow_type='resource'
  resource_role TEXT,
  resource_rate NUMERIC(10, 2),
  -- Finance approval (client side)
  finance_approved_by TEXT REFERENCES users(id),
  finance_approved_at TIMESTAMPTZ,
  finance_notes TEXT,
  -- Manager signature (client side; mocked DocuSign)
  manager_signed_by TEXT REFERENCES users(id),
  manager_signed_at TIMESTAMPTZ,
  docusign_envelope_id TEXT,
  docusign_status TEXT,
  -- Rejection trail
  rejected_by TEXT REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Audit
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sows_client ON sows (client_id);
CREATE INDEX IF NOT EXISTS idx_sows_status ON sows (status);
CREATE INDEX IF NOT EXISTS idx_sows_project ON sows (project_id);

ALTER TABLE sows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sows_select_internal" ON sows;
DROP POLICY IF EXISTS "sows_select_internal" ON sows;
CREATE POLICY "sows_select_internal" ON sows FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "sows_select_client" ON sows;
DROP POLICY IF EXISTS "sows_select_client" ON sows;
CREATE POLICY "sows_select_client" ON sows FOR SELECT
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "sows_modify_internal" ON sows;
DROP POLICY IF EXISTS "sows_modify_internal" ON sows;
CREATE POLICY "sows_modify_internal" ON sows FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "sows_update_client" ON sows;
DROP POLICY IF EXISTS "sows_update_client" ON sows;
CREATE POLICY "sows_update_client" ON sows FOR UPDATE
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

-- Client manager approval on timesheets + invoice payment receipt URLs
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS client_approved_by TEXT REFERENCES users(id);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS client_approval_status TEXT
  CHECK (client_approval_status IS NULL OR client_approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_manager_approved_by TEXT REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_manager_approved_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_remittance_ref TEXT;


-- ############################################################
-- # _build/missing-tables.sql
-- ############################################################

-- ============================================================
-- Tables that predate the tracked migrations.
--
-- These three tables were created by hand in the original Supabase
-- project and were never captured in schema.sql or any migration.
-- The app queries all three, so a database built only from the
-- tracked files is missing them and those screens break:
--
--   referrals      -- src/lib/supabaseApi.js  (/referrals GET,POST,PUT)
--                     migration-022-referral-resume.sql ALTERs it
--   sow_resources  -- src/lib/supabaseApi.js  (/sow-resources CRUD)
--                     src/client/lib/supabaseApi.js (manager lookup)
--   email_queue    -- src/lib/supabaseApi.js  (SOW send-to-finance)
--
-- Column shapes are reconstructed from the application's read/write
-- sites and from scripts/import_sow.py.
-- ============================================================

-- ── REFERRALS ──
-- Employee referral submissions against an open requirement.
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  requirement_id BIGINT REFERENCES requirements(id) ON DELETE SET NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_phone TEXT,
  referred_by TEXT REFERENCES users(id),
  referred_by_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON referrals (referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_requirement ON referrals (requirement_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- ── SOW RESOURCES ──
-- Flat roster of resources covered by a signed SOW. Keyed by name (the
-- app fuzzy-matches users.name against sow_resources.name) rather than
-- by user_id, because it also covers people with no login.
CREATE TABLE IF NOT EXISTS sow_resources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  project TEXT,
  manager TEXT,
  location TEXT,
  rate NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  sow_number TEXT,
  sow_file TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_resources_name ON sow_resources (lower(name));
CREATE INDEX IF NOT EXISTS idx_sow_resources_status ON sow_resources (status);
CREATE INDEX IF NOT EXISTS idx_sow_resources_sow_number ON sow_resources (sow_number);

ALTER TABLE sow_resources ENABLE ROW LEVEL SECURITY;

-- ── EMAIL QUEUE ──
-- Outbound mail parked by the SOW submit-to-finance flow and drained by
-- the serverless mailer. The app already tolerates this table being
-- absent (it warns and continues), but the queue silently drops mail
-- when it is.
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGSERIAL PRIMARY KEY,
  sow_id INTEGER REFERENCES sows(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  cc_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue (status);
CREATE INDEX IF NOT EXISTS idx_email_queue_sow ON email_queue (sow_id);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;


-- ############################################################
-- # migration-014-seed-finance-client-users.sql
-- ############################################################

-- Seed finance and client users for production login
-- These exist in demoData.js but were never inserted into Supabase

-- Ensure the clients table has the VCC client record (FK dependency)
INSERT INTO clients (id, name, region, contact_name, contact_email, status, notes)
VALUES ('CLT001', 'Visual Comfort Company', 'USA', 'VCC Finance', 'finance@visualcomfort.com', 'active', 'Primary client - all VCC projects')
ON CONFLICT (id) DO NOTHING;

-- Finance user
INSERT INTO users (id, name, role, designation, project, start_date, end_date, hourly_rate, is_active, email, phone)
VALUES
  ('FIN001', 'Finance Lead', 'finance', 'Finance', NULL, '2024-01-01', NULL, 0, true, 'finance@d4insight.com', '+91-9876543201')
ON CONFLICT (id) DO UPDATE SET role = 'finance', is_active = true;

-- Client users removed


-- ############################################################
-- # migration-014-sow-changes-requested.sql
-- ############################################################

-- Add 'changes_requested' to the sows status check constraint
ALTER TABLE sows DROP CONSTRAINT IF EXISTS sows_status_check;
ALTER TABLE sows ADD CONSTRAINT sows_status_check
  CHECK (status IN ('draft', 'submitted_for_finance', 'changes_requested', 'finance_approved', 'sent_for_signature', 'signed', 'active', 'rejected', 'cancelled'));


-- ############################################################
-- # migration-015-docusign-columns.sql
-- ############################################################

-- Add DocuSign signer tracking columns to SOWs
ALTER TABLE sows ADD COLUMN IF NOT EXISTS docusign_signer_name TEXT;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS docusign_signer_email TEXT;

-- Index for webhook lookups by envelope ID
CREATE INDEX IF NOT EXISTS idx_sows_docusign_envelope ON sows (docusign_envelope_id)
  WHERE docusign_envelope_id IS NOT NULL;


-- ############################################################
-- # migration-015-vendors.sql
-- ############################################################

-- Vendors: third-party suppliers / sub-contractors associated with a client.
-- Visible to: admin/finance always; client_finance + client_manager only for their own client_id.

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  category TEXT,                 -- e.g. 'Staffing', 'Software', 'Consulting'
  contact_name TEXT,
  contact_email TEXT,
  phone TEXT,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  engagement_start DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_client ON vendors (client_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors (status);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_select_internal" ON vendors;
DROP POLICY IF EXISTS "vendors_select_internal" ON vendors;
CREATE POLICY "vendors_select_internal" ON vendors FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "vendors_select_client" ON vendors;
DROP POLICY IF EXISTS "vendors_select_client" ON vendors;
CREATE POLICY "vendors_select_client" ON vendors FOR SELECT
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "vendors_modify_internal" ON vendors;
DROP POLICY IF EXISTS "vendors_modify_internal" ON vendors;
CREATE POLICY "vendors_modify_internal" ON vendors FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

-- Seed a few example vendors for CLT001 (Visual Comfort Company).
INSERT INTO vendors (id, client_id, name, category, contact_name, contact_email, phone, region, status, engagement_start, notes) VALUES
  ('VEN001', 'CLT001', 'D4 Insight', 'Staffing & Delivery', 'Account Manager', 'partnerships@d4insight.com', '+91-9876543210', 'India / USA', 'active', '2023-06-01', 'Primary delivery partner for engineering resources.'),
  ('VEN002', 'CLT001', 'Bright Pixels Studio', 'Design & Creative', 'Priya Nair', 'priya@brightpixels.io', '+91-9000012345', 'India', 'active', '2024-01-15', 'UI/UX and visual design for the e-commerce refresh.'),
  ('VEN003', 'CLT001', 'NorthStar Cloud Ops', 'Cloud Infrastructure', 'James OBrien', 'james@northstarops.com', '+1-5552040918', 'USA', 'active', '2024-04-01', 'AWS migration and 24x7 cloud operations.'),
  ('VEN004', 'CLT001', 'LumenWare Software', 'Software Licensing', 'Vendor Relations', 'sales@lumenware.com', '+1-5557891011', 'USA', 'inactive', '2022-09-01', 'Legacy reporting tool — being phased out.')
ON CONFLICT (id) DO NOTHING;


-- ############################################################
-- # migration-016-roster-entries.sql
-- ############################################################

-- Roster entries: free-form client-managed list of resources working on the engagement.
-- Distinct from `users` so the client can record external vendor staff, contractors, etc.
-- Visible to: admin/finance always; client users see only their own client_id.
-- Manager-only write is enforced at the API layer (RLS only scopes to client_id).

CREATE TABLE IF NOT EXISTS roster_entries (
  id SERIAL PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  role TEXT,                          -- designation / job title
  vendor_id TEXT REFERENCES vendors(id),
  project TEXT,                       -- matches billable_projects.name when applicable
  email TEXT,
  billing_rate NUMERIC(10, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_entries_client ON roster_entries (client_id);
CREATE INDEX IF NOT EXISTS idx_roster_entries_vendor ON roster_entries (vendor_id);
CREATE INDEX IF NOT EXISTS idx_roster_entries_status ON roster_entries (status);

ALTER TABLE roster_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roster_entries_select_internal" ON roster_entries;
DROP POLICY IF EXISTS "roster_entries_select_internal" ON roster_entries;
CREATE POLICY "roster_entries_select_internal" ON roster_entries FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "roster_entries_select_client" ON roster_entries;
DROP POLICY IF EXISTS "roster_entries_select_client" ON roster_entries;
CREATE POLICY "roster_entries_select_client" ON roster_entries FOR SELECT
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "roster_entries_modify_internal" ON roster_entries;
DROP POLICY IF EXISTS "roster_entries_modify_internal" ON roster_entries;
CREATE POLICY "roster_entries_modify_internal" ON roster_entries FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "roster_entries_modify_client" ON roster_entries;
DROP POLICY IF EXISTS "roster_entries_modify_client" ON roster_entries;
CREATE POLICY "roster_entries_modify_client" ON roster_entries FOR ALL
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

-- Allow clients to insert/update vendors for their own client_id (manager-only enforced at API layer).
DROP POLICY IF EXISTS "vendors_modify_client" ON vendors;
DROP POLICY IF EXISTS "vendors_modify_client" ON vendors;
CREATE POLICY "vendors_modify_client" ON vendors FOR ALL
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );


-- ############################################################
-- # migration-017-vendor-realignment.sql
-- ############################################################

-- Realign the vendor model to match VCC's actual partner network.
-- Replaces the original seed vendors with Rysun, Deloitte, and D4 Insight,
-- adds vendor_id to users + billable_projects, and seeds sample projects
-- and user assignments so the timesheet/dashboard vendor filters have data.

-- 1. Schema additions
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_id TEXT REFERENCES vendors(id);
ALTER TABLE billable_projects ADD COLUMN IF NOT EXISTS vendor_id TEXT REFERENCES vendors(id);

CREATE INDEX IF NOT EXISTS idx_users_vendor ON users (vendor_id);
CREATE INDEX IF NOT EXISTS idx_billable_projects_vendor ON billable_projects (vendor_id);

-- 2. Drop FK rows that depend on the old vendors (free-form roster only).
DELETE FROM roster_entries WHERE vendor_id IN ('VEN001', 'VEN002', 'VEN003', 'VEN004');

-- 3. Replace the seed vendors with VCC's real partner set.
DELETE FROM vendors WHERE id IN ('VEN001', 'VEN002', 'VEN003', 'VEN004');

INSERT INTO vendors (id, client_id, name, category, contact_name, contact_email, phone, region, status, engagement_start, notes) VALUES
  ('RYSUN', 'CLT001', 'Rysun', 'Staffing & Delivery', 'Account Manager', 'partnerships@rysun.com', '+91-9000011001', 'India / USA', 'active', '2023-04-01', 'Primary engineering and QA partner.'),
  ('DLTT',  'CLT001', 'Deloitte', 'Consulting & Advisory', 'Engagement Partner', 'engagement@deloitte.com', '+1-2125550182', 'USA', 'active', '2023-09-15', 'Advisory and program governance.'),
  ('D4I',   'CLT001', 'D4 Insight', 'Analytics & Reporting', 'Account Lead', 'success@d4insight.com', '+91-9000011003', 'India', 'active', '2024-02-01', 'Reporting, analytics, and ETL.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  phone = EXCLUDED.phone,
  region = EXCLUDED.region,
  status = EXCLUDED.status,
  engagement_start = EXCLUDED.engagement_start,
  notes = EXCLUDED.notes,
  updated_at = now();

-- 4. Seed sample billable projects under each vendor for CLT001.
INSERT INTO billable_projects (id, name, client_id, vendor_id, billing_type, bill_rate, currency, status, notes) VALUES
  ('BP-RYSUN-PLAT', 'VCC - Platform Engineering',     'CLT001', 'RYSUN', 'hourly', 65, 'USD', 'active', 'Rysun core engineering pod.'),
  ('BP-RYSUN-QA',   'VCC - QA Automation',            'CLT001', 'RYSUN', 'hourly', 55, 'USD', 'active', 'Rysun QA + test automation.'),
  ('BP-RYSUN-MOB',  'VCC - Mobile Apps',              'CLT001', 'RYSUN', 'hourly', 70, 'USD', 'active', 'Rysun iOS/Android engineering.'),
  ('BP-DLTT-ADV',   'VCC - Digital Transformation',   'CLT001', 'DLTT',  'monthly_retainer', 45000, 'USD', 'active', 'Deloitte advisory retainer.'),
  ('BP-DLTT-PMO',   'VCC - PMO & Governance',         'CLT001', 'DLTT',  'monthly_retainer', 22000, 'USD', 'active', 'Deloitte PMO oversight.'),
  ('BP-D4I-RPT',    'VCC - Reporting & BI',           'CLT001', 'D4I',   'hourly', 50, 'USD', 'active', 'D4 Insight reporting team.'),
  ('BP-D4I-ETL',    'VCC - Data Pipeline & ETL',      'CLT001', 'D4I',   'hourly', 58, 'USD', 'active', 'D4 Insight data engineering.')
ON CONFLICT (id) DO UPDATE SET
  vendor_id = EXCLUDED.vendor_id,
  bill_rate = EXCLUDED.bill_rate,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = now();

-- 5. Assign existing employees to a vendor by their project name prefix where possible,
--    falling back to round-robin among the 3 vendors so demo views never look empty.
UPDATE users SET vendor_id = 'RYSUN' WHERE vendor_id IS NULL AND role = 'employee'
  AND (project ILIKE '%VCC%Platform%' OR project ILIKE '%VCC%Mobile%' OR project ILIKE '%VCC%QA%' OR project ILIKE '%Rysun%');
UPDATE users SET vendor_id = 'DLTT' WHERE vendor_id IS NULL AND role = 'employee'
  AND (project ILIKE '%Deloitte%' OR project ILIKE '%PMO%' OR project ILIKE '%Advisory%' OR project ILIKE '%Transformation%');
UPDATE users SET vendor_id = 'D4I' WHERE vendor_id IS NULL AND role = 'employee'
  AND (project ILIKE '%Reporting%' OR project ILIKE '%BI%' OR project ILIKE '%ETL%' OR project ILIKE '%D4%');

-- Round-robin fill for any remaining employees so the vendor filter has results for all vendors.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM users
  WHERE role = 'employee' AND vendor_id IS NULL
)
UPDATE users u SET vendor_id = CASE (r.rn - 1) % 3
  WHEN 0 THEN 'RYSUN'
  WHEN 1 THEN 'DLTT'
  ELSE 'D4I'
END
FROM ranked r WHERE r.id = u.id;


-- ############################################################
-- # migration-018-password-auth-audit.sql
-- ############################################################

-- Migration 018: Password authentication + Audit logging
-- Run in Supabase SQL Editor

-- ── Add password_hash column to users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ── AUDIT LOGS ──
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,           -- 'login' | 'login_failed' | 'create_user' | 'update_user' | 'delete_user' | 'update_salary' | 'view_salaries' | 'export_salaries' | etc.
  target_type TEXT,               -- 'user' | 'salary' | 'timesheet' | 'sow' | 'invoice' | etc.
  target_id TEXT,                 -- ID of the affected record
  details JSONB,                  -- Additional context (e.g. changed fields, old values)
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id);

-- RLS: open for now (app enforces access), tighten later
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_all" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_all" ON audit_logs;
CREATE POLICY "audit_logs_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Ensure password_hash is not returned in public user queries
-- (handled at app layer — supabaseApi strips it from responses)


-- ############################################################
-- # migration-019-invoice-file-upload.sql
-- ############################################################

-- Add file attachment support to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Create storage bucket for invoice documents (run in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;


-- ############################################################
-- # migration-020-sow-file-upload.sql
-- ############################################################

-- Add uploaded-document support to SOWs (e.g. the signed/source SOW PDF).
-- The file is stored in the existing public 'documents' storage bucket
-- (created in migration-019) under the 'sows/' prefix; these columns hold
-- the public URL and original filename, mapped to the SOW row / sow_number.
ALTER TABLE sows ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS file_name TEXT;


-- ############################################################
-- # migration-021-consultant-role.sql
-- ############################################################

-- Add 'consultant' role to the users.role CHECK constraint.
-- Run this in the Supabase SQL editor or via the CLI.
-- (Preserves the previously-added 'finance' and 'client' roles.)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('employee', 'manager', 'admin', 'finance', 'client', 'consultant'));


-- ############################################################
-- # migration-022-referral-resume.sql
-- ############################################################

-- Add resume attachment columns to referrals.
-- The file is stored in the private 'documents' storage bucket under
-- referrals/<referral_id>/..., resume_file holds the object path and
-- resume_filename the original filename. Viewed via short-lived signed URLs.
-- (The referrals table predates the tracked migrations, hence ALTER here.)
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS resume_file TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS resume_filename TEXT;


-- ############################################################
-- # migration-022-remove-dummy-vendors.sql
-- ############################################################

-- Remove the seeded demo vendors (Deloitte, Rysun) and consolidate everything
-- under the one real partner, D4 Insight. All delivery staff are @d4insight.com,
-- so D4 Insight is the actual vendor; Deloitte/Rysun were demo placeholders from
-- migration-017. Also normalises a stray 9-box period string so placements show.

-- 1. Re-point every reference away from the dummy vendors BEFORE deleting them
--    (users.vendor_id and billable_projects.vendor_id both FK to vendors.id).
UPDATE users SET vendor_id = 'D4I'
  WHERE vendor_id IN ('DLTT', 'RYSUN');

-- 2. Attribute all of the client's real delivery staff + projects to D4 Insight.
UPDATE users SET vendor_id = 'D4I'
  WHERE role IN ('employee', 'consultant', 'manager') AND vendor_id IS NULL;

UPDATE billable_projects SET vendor_id = 'D4I'
  WHERE client_id = 'CLT001';

-- 3. Drop free-form roster rows tied to the dummy vendors, then the vendors.
DELETE FROM roster_entries WHERE vendor_id IN ('DLTT', 'RYSUN');
DELETE FROM vendors WHERE id IN ('DLTT', 'RYSUN');

-- 4. Normalise the inconsistent 9-box period label so those placements appear
--    under the standard "Q<n> YYYY" filter used by both the admin and client grids.
--    First drop any stray-format row that would collide with an already-correct
--    row for the same resource (unique constraint on user_id + period), then
--    rename the remaining stray-format rows.
DELETE FROM ninebox_placements a
  USING ninebox_placements b
  WHERE a.period = '2026-Q2' AND b.period = 'Q2 2026' AND a.user_id = b.user_id;

UPDATE ninebox_placements SET period = 'Q2 2026' WHERE period = '2026-Q2';


-- ############################################################
-- # migration-023-seed-client-manager.sql
-- ############################################################

-- Seed a Client Manager login for the client portal (Vendor Tool).
-- Convention: CLI001 = Client Finance, CLI002 = Client Manager.
-- The portal logs in by Employee ID against role='client' + is_active=true,
-- and reads client_subrole to decide the manager vs finance experience.

INSERT INTO clients (id, name, region, contact_name, contact_email, status, notes)
VALUES ('CLT001', 'Visual Comfort Company', 'USA', 'VCC', 'finance@visualcomfort.com', 'active', 'Primary client')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, role, client_id, client_subrole, is_active, email, phone, start_date)
VALUES ('CLI002', 'Client Manager', 'client', 'CLT001', 'manager', true, 'manager@visualcomfort.com', NULL, '2024-01-01')
ON CONFLICT (id) DO UPDATE
  SET role = 'client', client_id = 'CLT001', client_subrole = 'manager', is_active = true;


-- ############################################################
-- # _build/storage-and-rls.sql
-- ############################################################

-- ============================================================
-- Storage bucket + anon-key access policies
-- ============================================================

-- ── STORAGE ──
-- One private 'documents' bucket. src/lib/api.js getFileUrl() mints a
-- short-lived signed URL for anything stored here, so the bucket must
-- NOT be public. Invoice attachments (migration 019), SOW attachments
-- (migration 020) and referral resumes (migration 022) all live here.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_read" ON storage.objects;
DROP POLICY IF EXISTS "documents_read" ON storage.objects;
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_write" ON storage.objects;
DROP POLICY IF EXISTS "documents_write" ON storage.objects;
CREATE POLICY "documents_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents');


-- ============================================================
-- ── ROW LEVEL SECURITY: open access for the anon key ──
--
-- READ THIS BEFORE RUNNING.
--
-- This app does not use Supabase Auth. It authenticates users itself
-- (src/lib/supabaseApi.js '/auth/login') and enforces role rules in
-- application code. But the RLS policies written in schema.sql and in
-- migrations 010-016 gate every row on get_user_role(), which reads
-- auth.uid() -- always NULL here. Under the anon key those policies
-- therefore match nothing and every finance, SOW, vendor and roster
-- screen comes back empty.
--
-- There are exactly two ways to make the app show data:
--
--   A) Ship the SERVICE ROLE key to the browser (VITE_SUPABASE_SERVICE_KEY).
--      This is what the code does today. It bypasses RLS entirely and
--      also hands every visitor full admin rights over the project,
--      including Storage and the ability to read and rewrite any table.
--      Anyone who opens devtools has it.
--
--   B) Run the block below and ship only the ANON key.
--      Access is still wide open at the database level -- the anon key
--      can read and write every table -- but it cannot touch project
--      administration, and it can be rotated without redeploying keys
--      that grant more than data access.
--
-- Neither option is safe for real customer data. (B) is the lesser of
-- the two and is what SETUP.md recommends for the demo. Replacing these
-- policies with real per-role rules is the follow-up work needed before
-- this database holds anything that is not demo data.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo_open_access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "demo_open_access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;

