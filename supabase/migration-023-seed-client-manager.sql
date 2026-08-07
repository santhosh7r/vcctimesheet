-- Seed a Client Manager login for the client portal (Vendor Tool).
-- Convention: CLI001 = Client Finance, CLI002 = Client Manager.
-- The portal logs in by Employee ID against role='client' + is_active=true,
-- and reads client_subrole to decide the manager vs finance experience.

INSERT INTO clients (id, name, region, contact_name, contact_email, status, notes)
VALUES ('CLT001', 'Visual Comfort Company', 'USA', 'VCC', 'finance@visualcomfort.com', 'active', 'Primary client')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, role, client_id, client_subrole, is_active, email, phone, start_date)
VALUES ('CLI002', 'Client Manager', 'client', 'CLT001', 'manager', true, 'manager@visualcomfort.com', NULL, '2024-01-01')
ON CONFLICT (id) DO UPDATE
  SET role = 'client', client_id = 'CLT001', client_subrole = 'manager', is_active = true;
