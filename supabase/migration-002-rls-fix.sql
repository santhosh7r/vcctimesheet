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
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);

-- TIMESHEETS
DROP POLICY IF EXISTS "Employees see own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees manage own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Employees update own timesheets" ON timesheets;
CREATE POLICY "Allow all access to timesheets" ON timesheets FOR ALL USING (true) WITH CHECK (true);

-- TIMESHEET ENTRIES
DROP POLICY IF EXISTS "Entries follow timesheet access" ON timesheet_entries;
CREATE POLICY "Allow all access to timesheet_entries" ON timesheet_entries FOR ALL USING (true) WITH CHECK (true);

-- LEAVES
DROP POLICY IF EXISTS "Employees see own leaves" ON leaves;
DROP POLICY IF EXISTS "Employees create own leaves" ON leaves;
DROP POLICY IF EXISTS "Managers approve leaves" ON leaves;
CREATE POLICY "Allow all access to leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);

-- LEAVE BALANCES
DROP POLICY IF EXISTS "Employees see own balances" ON leave_balances;
DROP POLICY IF EXISTS "Admins manage balances" ON leave_balances;
CREATE POLICY "Allow all access to leave_balances" ON leave_balances FOR ALL USING (true) WITH CHECK (true);

-- TASKS
DROP POLICY IF EXISTS "Users see relevant tasks" ON tasks;
DROP POLICY IF EXISTS "Managers create tasks" ON tasks;
DROP POLICY IF EXISTS "Task participants update" ON tasks;
DROP POLICY IF EXISTS "Managers delete tasks" ON tasks;
CREATE POLICY "Allow all access to tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- DOCUMENTS
DROP POLICY IF EXISTS "Users see own docs" ON documents;
DROP POLICY IF EXISTS "Upload docs" ON documents;
DROP POLICY IF EXISTS "Delete docs" ON documents;
CREATE POLICY "Allow all access to documents" ON documents FOR ALL USING (true) WITH CHECK (true);

-- FROZEN PERIODS
DROP POLICY IF EXISTS "All can read frozen periods" ON frozen_periods;
DROP POLICY IF EXISTS "Admins manage frozen periods" ON frozen_periods;
CREATE POLICY "Allow all access to frozen_periods" ON frozen_periods FOR ALL USING (true) WITH CHECK (true);

-- REQUIREMENTS
DROP POLICY IF EXISTS "All can read requirements" ON requirements;
DROP POLICY IF EXISTS "Admins manage requirements" ON requirements;
CREATE POLICY "Allow all access to requirements" ON requirements FOR ALL USING (true) WITH CHECK (true);

-- MEETINGS
DROP POLICY IF EXISTS "All can read meetings" ON meetings;
DROP POLICY IF EXISTS "Managers manage meetings" ON meetings;
CREATE POLICY "Allow all access to meetings" ON meetings FOR ALL USING (true) WITH CHECK (true);

-- MEETING ACTIONS
DROP POLICY IF EXISTS "All can read meeting actions" ON meeting_actions;
DROP POLICY IF EXISTS "Managers manage meeting actions" ON meeting_actions;
DROP POLICY IF EXISTS "Assignees update meeting actions" ON meeting_actions;
CREATE POLICY "Allow all access to meeting_actions" ON meeting_actions FOR ALL USING (true) WITH CHECK (true);

-- SALES DEALS
DROP POLICY IF EXISTS "All can read sales deals" ON sales_deals;
DROP POLICY IF EXISTS "Admins manage sales deals" ON sales_deals;
CREATE POLICY "Allow all access to sales_deals" ON sales_deals FOR ALL USING (true) WITH CHECK (true);

-- SALES ACTIVITIES
DROP POLICY IF EXISTS "All can read sales activities" ON sales_activities;
DROP POLICY IF EXISTS "Admins manage sales activities" ON sales_activities;
CREATE POLICY "Allow all access to sales_activities" ON sales_activities FOR ALL USING (true) WITH CHECK (true);

-- NINEBOX
DROP POLICY IF EXISTS "All can read ninebox" ON ninebox_placements;
DROP POLICY IF EXISTS "Admins manage ninebox" ON ninebox_placements;
CREATE POLICY "Allow all access to ninebox_placements" ON ninebox_placements FOR ALL USING (true) WITH CHECK (true);

-- KPI SCORES
DROP POLICY IF EXISTS "All can read kpi scores" ON kpi_scores;
DROP POLICY IF EXISTS "Managers manage kpi scores" ON kpi_scores;
CREATE POLICY "Allow all access to kpi_scores" ON kpi_scores FOR ALL USING (true) WITH CHECK (true);

-- SOP TEMPLATES
DROP POLICY IF EXISTS "Admins read sop templates" ON sop_templates;
DROP POLICY IF EXISTS "Admins manage sop templates" ON sop_templates;
CREATE POLICY "Allow all access to sop_templates" ON sop_templates FOR ALL USING (true) WITH CHECK (true);

-- SOP DOCUMENTS
DROP POLICY IF EXISTS "Admins read sop documents" ON sop_documents;
DROP POLICY IF EXISTS "Admins manage sop documents" ON sop_documents;
CREATE POLICY "Allow all access to sop_documents" ON sop_documents FOR ALL USING (true) WITH CHECK (true);

-- SHAREPOINT SYNC LOG
DROP POLICY IF EXISTS "Admins read sync log" ON sharepoint_sync_log;
CREATE POLICY "Allow all access to sharepoint_sync_log" ON sharepoint_sync_log FOR ALL USING (true) WITH CHECK (true);

-- NOTIFICATION SCHEDULE
DROP POLICY IF EXISTS "Admins read notifications" ON notification_schedule;
CREATE POLICY "Allow all access to notification_schedule" ON notification_schedule FOR ALL USING (true) WITH CHECK (true);

-- CONSOLIDATION REPORTS
DROP POLICY IF EXISTS "Admins read reports" ON consolidation_reports;
CREATE POLICY "Allow all access to consolidation_reports" ON consolidation_reports FOR ALL USING (true) WITH CHECK (true);

-- INTEGRATION CONFIG
DROP POLICY IF EXISTS "Admins read integration config" ON integration_config;
DROP POLICY IF EXISTS "Admins manage integration config" ON integration_config;
CREATE POLICY "Allow all access to integration_config" ON integration_config FOR ALL USING (true) WITH CHECK (true);

-- SHAREPOINT FIELD MAPPING
CREATE POLICY "Allow all access to sharepoint_field_mapping" ON sharepoint_field_mapping FOR ALL USING (true) WITH CHECK (true);
