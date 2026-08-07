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
