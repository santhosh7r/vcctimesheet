-- Add 'consultant' role to the users.role CHECK constraint.
-- Run this in the Supabase SQL editor or via the CLI.
-- (Preserves the previously-added 'finance' and 'client' roles.)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('employee', 'manager', 'admin', 'finance', 'client', 'consultant'));
