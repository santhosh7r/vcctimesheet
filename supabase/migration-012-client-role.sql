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
