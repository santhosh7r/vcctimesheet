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
CREATE POLICY "sows_select_internal" ON sows FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "sows_select_client" ON sows;
CREATE POLICY "sows_select_client" ON sows FOR SELECT
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "sows_modify_internal" ON sows;
CREATE POLICY "sows_modify_internal" ON sows FOR ALL
  USING (get_user_role() IN ('admin', 'finance'))
  WITH CHECK (get_user_role() IN ('admin', 'finance'));

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
