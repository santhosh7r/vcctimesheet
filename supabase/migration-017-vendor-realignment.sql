-- Realign the vendor model to match VCC's actual partner network.
-- Replaces the original seed vendors with Rysun, Deloitte, and D4 Insight,
-- adds vendor_id to users + billable_projects, and seeds sample projects
-- and user assignments so the timesheet/dashboard vendor filters have data.

-- 1. Schema additions
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_id TEXT REFERENCES vendors(id);
ALTER TABLE billable_projects ADD COLUMN IF NOT EXISTS vendor_id TEXT REFERENCES vendors(id);

CREATE INDEX IF NOT EXISTS idx_users_vendor ON users (vendor_id);
CREATE INDEX IF NOT EXISTS idx_billable_projects_vendor ON billable_projects (vendor_id);

-- 2. Drop FK rows that depend on the old vendors (free-form roster only).
DELETE FROM roster_entries WHERE vendor_id IN ('VEN001', 'VEN002', 'VEN003', 'VEN004');

-- 3. Replace the seed vendors with VCC's real partner set.
DELETE FROM vendors WHERE id IN ('VEN001', 'VEN002', 'VEN003', 'VEN004');

INSERT INTO vendors (id, client_id, name, category, contact_name, contact_email, phone, region, status, engagement_start, notes) VALUES
  ('RYSUN', 'CLT001', 'Rysun', 'Staffing & Delivery', 'Account Manager', 'partnerships@rysun.com', '+91-9000011001', 'India / USA', 'active', '2023-04-01', 'Primary engineering and QA partner.'),
  ('DLTT',  'CLT001', 'Deloitte', 'Consulting & Advisory', 'Engagement Partner', 'engagement@deloitte.com', '+1-2125550182', 'USA', 'active', '2023-09-15', 'Advisory and program governance.'),
  ('D4I',   'CLT001', 'D4 Insight', 'Analytics & Reporting', 'Account Lead', 'success@d4insight.com', '+91-9000011003', 'India', 'active', '2024-02-01', 'Reporting, analytics, and ETL.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  phone = EXCLUDED.phone,
  region = EXCLUDED.region,
  status = EXCLUDED.status,
  engagement_start = EXCLUDED.engagement_start,
  notes = EXCLUDED.notes,
  updated_at = now();

-- 4. Seed sample billable projects under each vendor for CLT001.
INSERT INTO billable_projects (id, name, client_id, vendor_id, billing_type, bill_rate, currency, status, notes) VALUES
  ('BP-RYSUN-PLAT', 'VCC - Platform Engineering',     'CLT001', 'RYSUN', 'hourly', 65, 'USD', 'active', 'Rysun core engineering pod.'),
  ('BP-RYSUN-QA',   'VCC - QA Automation',            'CLT001', 'RYSUN', 'hourly', 55, 'USD', 'active', 'Rysun QA + test automation.'),
  ('BP-RYSUN-MOB',  'VCC - Mobile Apps',              'CLT001', 'RYSUN', 'hourly', 70, 'USD', 'active', 'Rysun iOS/Android engineering.'),
  ('BP-DLTT-ADV',   'VCC - Digital Transformation',   'CLT001', 'DLTT',  'monthly_retainer', 45000, 'USD', 'active', 'Deloitte advisory retainer.'),
  ('BP-DLTT-PMO',   'VCC - PMO & Governance',         'CLT001', 'DLTT',  'monthly_retainer', 22000, 'USD', 'active', 'Deloitte PMO oversight.'),
  ('BP-D4I-RPT',    'VCC - Reporting & BI',           'CLT001', 'D4I',   'hourly', 50, 'USD', 'active', 'D4 Insight reporting team.'),
  ('BP-D4I-ETL',    'VCC - Data Pipeline & ETL',      'CLT001', 'D4I',   'hourly', 58, 'USD', 'active', 'D4 Insight data engineering.')
ON CONFLICT (id) DO UPDATE SET
  vendor_id = EXCLUDED.vendor_id,
  bill_rate = EXCLUDED.bill_rate,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = now();

-- 5. Assign existing employees to a vendor by their project name prefix where possible,
--    falling back to round-robin among the 3 vendors so demo views never look empty.
UPDATE users SET vendor_id = 'RYSUN' WHERE vendor_id IS NULL AND role = 'employee'
  AND (project ILIKE '%VCC%Platform%' OR project ILIKE '%VCC%Mobile%' OR project ILIKE '%VCC%QA%' OR project ILIKE '%Rysun%');
UPDATE users SET vendor_id = 'DLTT' WHERE vendor_id IS NULL AND role = 'employee'
  AND (project ILIKE '%Deloitte%' OR project ILIKE '%PMO%' OR project ILIKE '%Advisory%' OR project ILIKE '%Transformation%');
UPDATE users SET vendor_id = 'D4I' WHERE vendor_id IS NULL AND role = 'employee'
  AND (project ILIKE '%Reporting%' OR project ILIKE '%BI%' OR project ILIKE '%ETL%' OR project ILIKE '%D4%');

-- Round-robin fill for any remaining employees so the vendor filter has results for all vendors.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM users
  WHERE role = 'employee' AND vendor_id IS NULL
)
UPDATE users u SET vendor_id = CASE (r.rn - 1) % 3
  WHEN 0 THEN 'RYSUN'
  WHEN 1 THEN 'DLTT'
  ELSE 'D4I'
END
FROM ranked r WHERE r.id = u.id;
