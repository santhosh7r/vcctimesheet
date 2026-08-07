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
CREATE POLICY "roster_entries_select_internal" ON roster_entries FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "roster_entries_select_client" ON roster_entries;
CREATE POLICY "roster_entries_select_client" ON roster_entries FOR SELECT
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "roster_entries_modify_internal" ON roster_entries;
CREATE POLICY "roster_entries_modify_internal" ON roster_entries FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

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
CREATE POLICY "vendors_modify_client" ON vendors FOR ALL
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  )
  WITH CHECK (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );
