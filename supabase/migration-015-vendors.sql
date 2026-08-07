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
CREATE POLICY "vendors_select_internal" ON vendors FOR SELECT
  USING (get_user_role() IN ('admin', 'finance'));

DROP POLICY IF EXISTS "vendors_select_client" ON vendors;
CREATE POLICY "vendors_select_client" ON vendors FOR SELECT
  USING (
    get_user_role() = 'client'
    AND client_id IN (SELECT client_id FROM users WHERE id = auth.uid()::text)
  );

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
