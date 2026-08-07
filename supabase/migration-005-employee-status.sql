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
