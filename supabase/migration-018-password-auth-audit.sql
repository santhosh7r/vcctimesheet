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
CREATE POLICY "audit_logs_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Ensure password_hash is not returned in public user queries
-- (handled at app layer — supabaseApi strips it from responses)
