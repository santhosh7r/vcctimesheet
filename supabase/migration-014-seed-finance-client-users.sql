-- Seed finance and client users for production login
-- These exist in demoData.js but were never inserted into Supabase

-- Ensure the clients table has the VCC client record (FK dependency)
INSERT INTO clients (id, name, region, contact_name, contact_email, status, notes)
VALUES ('CLT001', 'Visual Comfort Company', 'USA', 'VCC Finance', 'finance@visualcomfort.com', 'active', 'Primary client - all VCC projects')
ON CONFLICT (id) DO NOTHING;

-- Finance user
INSERT INTO users (id, name, role, designation, project, start_date, end_date, hourly_rate, is_active, email, phone)
VALUES
  ('FIN001', 'Finance Lead', 'finance', 'Finance', NULL, '2024-01-01', NULL, 0, true, 'finance@d4insight.com', '+91-9876543201')
ON CONFLICT (id) DO UPDATE SET role = 'finance', is_active = true;

-- Client users removed
