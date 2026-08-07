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
