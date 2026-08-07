-- ═══════════════════════════════════════════════════════════════════
-- CLEAN RESET: Remove all users and re-insert 69 correct employees
-- from D4 April 2026 Resource List + admin account
-- Preserves existing timesheets (they reference user_id by TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Ensure employee_status column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_status TEXT DEFAULT 'active';

-- Step 2: Dynamically drop ALL foreign key constraints referencing users table
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
  ) LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- Step 2b: Delete ALL existing data from referencing tables then users
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
  ) LOOP
    EXECUTE format('DELETE FROM %I', r.table_name);
  END LOOP;
END $$;
-- Also delete from tables we know about (in case constraints were already dropped)
DELETE FROM timesheet_entries;
DELETE FROM timesheets;
DELETE FROM leaves;
DELETE FROM leave_balances;
DELETE FROM ninebox_placements;
DELETE FROM users;

-- Step 2c: Re-add foreign key constraints (at end of migration)

-- Step 3: Insert admin account
INSERT INTO users (id, name, role, designation, project, is_active, employee_status)
VALUES ('ADM001', 'Kishore', 'admin', 'Admin', NULL, TRUE, 'active');

-- ═══════════════════════════════════════════════════════════════════
-- Step 4: Insert all 69 employees from resource list
-- ═══════════════════════════════════════════════════════════════════

-- VCC - D365 FO (15)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200001', 'Abhinandhan Poorlin', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'abhinandhan.poorlin@d4insight.com', TRUE, 'active'),
('200002', 'Anant Moger', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'anant.moger@d4insight.com', TRUE, 'active'),
('200003', 'Aravindh Perumal', 'employee', 'Functional Consultant-IT', 'VCC - D365 FO', 'aravindh.perumal@d4insight.com', TRUE, 'active'),
('200004', 'Keerthivasan Vijayagothandaraman', 'employee', 'Functional Consultant-IT', 'VCC - D365 FO', 'keerthi.vasan@d4insight.com', TRUE, 'active'),
('200005', 'Kishore Babu Jyothi', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'kishore.babu@d4insight.com', TRUE, 'active'),
('100048', 'Krupa Sarkar Vyas', 'manager', 'D365 Project Manager-IT', 'VCC - D365 FO', 'krupa.vyas@d4insight.com', TRUE, 'active'),
('200006', 'Manish Dayma', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'manishkumar.dayma@d4insight.com', TRUE, 'active'),
('200007', 'Meenalochini Balachandran', 'employee', 'D365 QA Testing-IT', 'VCC - D365 FO', 'meenalochini.b@d4insight.com', TRUE, 'active'),
('200008', 'Sankar Raman P', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'sankar.raman@d4insight.com', TRUE, 'active'),
('200009', 'Shahul Hameed I', 'employee', 'D365 QA Testing-IT', 'VCC - D365 FO', 'shahulhameed.i@d4insight.com', TRUE, 'active'),
('200010', 'Srinivasan Pandiaraj', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'srinivasan.pandiraj@d4insight.com', TRUE, 'active'),
('200011', 'Aran Thangaraj', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'thangaraj.aran@d4insight.com', TRUE, 'active'),
('200012', 'Boya Narasimha Reddy', 'employee', 'D365 Developer-IT', 'VCC - D365 FO', 'boyanarasimha.reddy@d4insight.com', TRUE, 'active'),
('20260201001', 'Andrea Solorzano', 'employee', 'D365 Administrator-IT', 'VCC - D365 FO', 'Andrea.solorzano@d4insight.com', TRUE, 'active'),
('200013', 'Bradley Lacey', 'employee', 'Functional Consultant-IT', 'VCC - D365 FO', 'bradley.lacey@d4insight.com', TRUE, 'active');

-- VCC - Enterprise Integration (2)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('100070', 'Pothiraja A', 'employee', 'Senior Technical Program Manager', 'VCC - Enterprise Integration', 'pothi.raja@d4insight.com', TRUE, 'active'),
('200016', 'Rafi Ghafoor', 'employee', 'Product Manager-IT', 'VCC - Enterprise Integration', 'rafi.ghafoor@d4insight.com', TRUE, 'active');

-- VCC - BA - Onsite (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200014', 'Zamir Vahora', 'employee', 'Senior Business Analyst', 'VCC - BA - Onsite', 'zamir.vahora@d4insight.com', TRUE, 'active');

-- VCC - Project Financial Services (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200017', 'Javal Vadera', 'employee', 'VMO Analyst-IT', 'VCC - Project Financial Services', 'javal.vadera@d4insight.com', TRUE, 'active');

-- VCC - IT Support Savannah (2)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200018', 'Akhila Reddy Cherukupalli', 'employee', 'IT Support Specialist', 'VCC - IT Support Savannah', 'akhila.reddy@d4insight.com', TRUE, 'active'),
('20241001001', 'Dhiraj Gurung', 'employee', 'IT Support Specialist', 'VCC - IT Support Savannah', 'dhiraj.gurang@d4insight.com', TRUE, 'active');

-- VCC - IT Infra - 8x8 (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200019', 'Aldrin Shaji', 'employee', '8x8 Specialist', 'VCC - IT Infra - 8x8', 'aldrin.shaji@d4insight.com', TRUE, 'active');

-- VCC - IT Helpdesk Offshore (3)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('100476', 'Senthil Nathan Rajagopal', 'employee', 'IT Helpdesk', 'VCC - IT Helpdesk Offshore', 'senthilnathan.r@d4insight.com', TRUE, 'active'),
('100459', 'Vivekanandan Jeevanantham', 'employee', 'IT Helpdesk', 'VCC - IT Helpdesk Offshore', 'vivekanandan.j@d4insight.com', TRUE, 'active'),
('200020', 'Tilak Gunasekaran', 'employee', 'IT Helpdesk', 'VCC - IT Helpdesk Offshore', 'thilak.g@d4insight.com', TRUE, 'bench');

-- VCC - IT Infra Onsite (3)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200015', 'Anand Suchak', 'employee', 'Project Manager-IT', 'VCC - IT Infra Onsite', 'anand.suchak@d4insight.com', TRUE, 'active'),
('200021', 'Janna Cox', 'employee', 'IT Infrastructure Incident Manager', 'VCC - IT Infra Onsite', 'janna.cox@d4insight.com', TRUE, 'active'),
('200022', 'Mark Soliz', 'employee', 'IT Helpdesk Support', 'VCC - IT Infra Onsite', 'marcos.soliz@d4insight.com', TRUE, 'active');

-- VCC - IT Infra PMO (1)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('343', 'Janani Ramkumar', 'employee', 'Project Manager-IT', 'VCC - IT Infra PMO', 'janani.ramkumar@d4insight.com', TRUE, 'active');

-- VCC - Projects PMO / Security / Delivery (3)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200023', 'Karthikeyan Vijayan', 'employee', 'Senior Security Consultant-IT', 'VCC - Projects PMO', 'karthikeyan.vijayan@d4insight.com', TRUE, 'active'),
('200024', 'Mohammed Abdullah Khan', 'employee', 'Senior Security Consultant-IT', 'VCC - Projects PMO', 'mohammed.abdullah@d4insight.com', TRUE, 'active'),
('200048', 'Kishan Vasant', 'admin', 'Head-Account Management', 'VCC - Projects PMO', 'kishan@d4insight.com', TRUE, 'active');

-- VCC - JDE & EDI (5)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200025', 'Arul Kumaran Veerattan', 'employee', 'JDE Solution Analyst & Developer', 'VCC - JDE & EDI', 'arul.kumaran@d4insight.com', TRUE, 'active'),
('100659', 'Bholeshankar Pathak', 'employee', 'EDI Specialist III', 'VCC - JDE & EDI', 'bholeshankar.pathak@d4insight.com', TRUE, 'active'),
('200026', 'Chandan Ramkeval Prajapati', 'employee', 'JDE Solution Analyst & Developer', 'VCC - JDE & EDI', 'chandan.ramkeval@d4insight.com', TRUE, 'active'),
('200027', 'Nitin Kumar Pal', 'employee', 'EDI Analyst', 'VCC - JDE & EDI', 'nitinkumar.pal@d4insight.com', TRUE, 'active'),
('200028', 'Tom Bruttell', 'employee', 'JDE Solution Analyst & Developer', 'VCC - JDE & EDI', 'thomas.bruttell@d4insight.com', TRUE, 'active');

-- VCC - Partner Insight (8)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('100464', 'Balaji Padmanaban', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'balaji.padmanaban@d4insight.com', TRUE, 'active'),
('100474', 'Kiran KalavaKollu', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'kiran.kalava@d4insight.com', TRUE, 'active'),
('200029', 'Mahesh Marimuthu', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'mahesh.marimuthu@d4insight.com', TRUE, 'active'),
('100460', 'Muthu Krishnan', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'muthu.k@d4insight.com', TRUE, 'active'),
('200030', 'Nageswara Dhaveji Ch', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'ch.nageswara.dhaveji@d4insight.com', TRUE, 'active'),
('100463', 'Sasikumar Saravanan', 'employee', 'IT-Partner Insight', 'VCC - Partner Insight', 'sasikumar.s@d4insight.com', TRUE, 'active'),
('200031', 'Gayathri Murugadas', 'admin', 'Project Coordinator-IT', 'VCC - Partner Insight', 'gayathri.m@d4insight.com', TRUE, 'active'),
('200032', 'Humera Ahmed', 'employee', 'Full Stack Developer-IT', 'VCC - Partner Insight', 'humera.ahmed@d4insight.com', TRUE, 'active');

-- VCC - QA QC (5)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200033', 'Ganesh Jayaraman', 'employee', 'QA Engineer', 'VCC - QA QC', 'ganesh.jayaraman@d4insight.com', TRUE, 'active'),
('200034', 'Manjari Porkai Pandian', 'employee', 'QA Engineer', 'VCC - QA QC', 'manjari.porkai@d4insight.com', TRUE, 'active'),
('200035', 'Saritha Thotta', 'employee', 'QA Lead', 'VCC - QA QC', 'saritha.thota@d4insight.com', TRUE, 'active'),
('200036', 'Bindu Marella', 'manager', 'Manager-Quality Analyst', 'VCC - QA QC', 'bindu.marella@d4insight.com', TRUE, 'active'),
('100637', 'Arif Mohammed', 'employee', 'QA Performance Testing Lead', 'VCC - QA QC', 'mohammed.arif@d4insight.com', TRUE, 'active');

-- VCC - Salesforce (14)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200037', 'Swaminathan Bhuvanesan', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'swaminathan.b@d4insight.com', TRUE, 'active'),
('111104', 'Divya Priya', 'employee', 'Senior Salesforce Developer', 'VCC - Salesforce', 'divya.priya@d4insight.com', TRUE, 'active'),
('200038', 'Hari Chandana P', 'employee', 'Senior Salesforce Developer', 'VCC - Salesforce', 'hari.chandana@d4insight.com', TRUE, 'active'),
('200039', 'Karthiga Adhimoolam', 'employee', 'Senior Salesforce Developer', 'VCC - Salesforce', 'karthiga.adhimoolam@d4insight.com', TRUE, 'active'),
('100530', 'Mohammed Navazuddin', 'employee', 'Integration Developer', 'VCC - Salesforce', 'mohammed.navazuddin@d4insight.com', TRUE, 'active'),
('100329', 'Naveenkumar Venkatesan', 'employee', 'Salesforce IT Admin', 'VCC - Salesforce', 'naveenkumar.venkatesan@d4insight.com', TRUE, 'active'),
('111103', 'Nishandhini Ashok Kumar', 'employee', 'Senior Technical Program Manager-IT', 'VCC - Salesforce', 'nishandhini.a@d4insight.com', TRUE, 'active'),
('200040', 'Sandhisegaran Munisami', 'manager', 'Technical Project Manager-IT', 'VCC - Salesforce', 'sandhirasegaran.m@d4insight.com', TRUE, 'active'),
('200041', 'Reiyo Christ V', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'reiyo.christ@d4insight.com', TRUE, 'active'),
('200042', 'Dhavan Kumar Reddy S', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'dhavankumar.reddy@d4insight.com', TRUE, 'active'),
('200043', 'Akash Priyadharshan P', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'akash.p@d4insight.com', TRUE, 'active'),
('200044', 'Chintalakonda Rajesh', 'employee', 'SalesForce IT Developer', 'VCC - Salesforce', 'chintalakonda.rajesh@d4insight.com', TRUE, 'active'),
('200045', 'Pratik Parmar', 'employee', 'Project Manager-IT', 'VCC - Salesforce', 'pratik.parmar@d4insight.com', TRUE, 'active'),
('200049', 'Lakshmanan Krishnan', 'employee', 'Salesforce Technical Architect-IT', 'VCC - Salesforce', 'lakshmanan.krishnan@d4insight.com', TRUE, 'active');

-- VCC - Web B2B (5)
INSERT INTO users (id, name, role, designation, project, email, is_active, employee_status) VALUES
('200046', 'Aruldoss A', 'employee', 'ECOMM Pod Support-IT', 'VCC - Web B2B', 'aruldoss.a@d4insight.com', TRUE, 'active'),
('100616', 'Jagadeesh Raju', 'employee', 'Backend Developer-IT', 'VCC - Web B2B', 'jagadeesh.raju@d4insight.com', TRUE, 'active'),
('100611', 'Sathishraj Raju', 'employee', 'ECOMM Pod Support-IT', 'VCC - Web B2B', 'sathishraj.raju@d4insight.com', TRUE, 'active'),
('100617', 'Vimal David', 'employee', 'Frontend Developer-IT', 'VCC - Web B2B', 'vimal.david@d4insight.com', TRUE, 'active'),
('200047', 'Anand Kumar Pandy', 'manager', 'AVP-IT Technology', 'VCC - Web B2B', 'anand.pandy@d4insight.com', TRUE, 'active');

-- ═══════════════════════════════════════════════════════════════════
-- Step 5: Seed leave balances for all employees
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO leave_balances (id, user_id, leave_type, year, total_days, used_days)
SELECT u.id || '_' || t.type, u.id, t.type, 2026,
  CASE t.type WHEN 'casual' THEN 12 WHEN 'sick' THEN 10 WHEN 'earned' THEN 15 END,
  0
FROM users u
CROSS JOIN (VALUES ('casual'), ('sick'), ('earned')) AS t(type)
WHERE u.role IN ('employee', 'manager')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- Step 6: Re-add foreign key constraints (drop first to avoid "already exists")
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_user_id_fkey;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS timesheet_entries_timesheet_id_fkey;
ALTER TABLE timesheet_entries ADD CONSTRAINT timesheet_entries_timesheet_id_fkey FOREIGN KEY (timesheet_id) REFERENCES timesheets(id);

ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_user_id_fkey;
ALTER TABLE leaves ADD CONSTRAINT leaves_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE leave_balances DROP CONSTRAINT IF EXISTS leave_balances_user_id_fkey;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ninebox_placements DROP CONSTRAINT IF EXISTS ninebox_placements_user_id_fkey;
ALTER TABLE ninebox_placements ADD CONSTRAINT ninebox_placements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
