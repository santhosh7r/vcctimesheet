import db from './database.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function seed() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  const users = [
    { id: '100070', name: 'Pothiraja A', role: 'employee', designation: 'Employee', project: 'VCC - Enterprise Integration', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 37 },
    { id: '100459', name: 'Vivekanandan Jeevanantham', role: 'employee', designation: 'Employee', project: 'VCC - IT Helpdesk Offshore', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 33 },
    { id: '100530', name: 'Mohammed Navazuddin', role: 'employee', designation: 'Employee', project: 'VCC - Salesforce', start_date: '2025-11-01', end_date: '2026-12-31', hourly_rate: 35 },
    { id: '100637', name: 'K P Mohammed Arif', role: 'employee', designation: 'Employee', project: 'VCC - QA QC', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 33 },
    { id: '111103', name: 'Nishandhini Ashok Kumar', role: 'employee', designation: 'Employee', project: 'VCC - Salesforce', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 33 },
    { id: '100464', name: 'Balaji Padmanaban', role: 'employee', designation: 'Employee', project: 'VCC - Partner Insight', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 33 },
    { id: '100617', name: 'Vimal David', role: 'employee', designation: 'Employee', project: 'VCC - Web B2B', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 39 },
    { id: '100611', name: 'Sathishraj Rajendran', role: 'employee', designation: 'Employee', project: 'VCC - Web B2B', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 39 },
    { id: '100616', name: 'Jagadeesh Raju', role: 'employee', designation: 'Employee', project: 'VCC - Web B2B', start_date: '2026-03-30', end_date: '2026-12-31', hourly_rate: 39 },
    { id: '111104', name: 'Divya Priya', role: 'employee', designation: 'Employee', project: 'VCC - Salesforce', start_date: '2025-11-01', end_date: '2026-12-31', hourly_rate: 35 },
    { id: '100659', name: 'Bholeshankar Pandey', role: 'employee', designation: 'Employee', project: 'VCC - JDE & EDI', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 37 },
    { id: '100510', name: 'Kishore', role: 'manager', designation: 'Manager', project: 'VCC - Partner Insight', start_date: '2026-03-09', end_date: '2026-12-31', hourly_rate: 50 },
    { id: '20241001001', name: 'Dhiraj Gurang', role: 'employee', designation: 'Employee', project: 'VCC - IT Support Savannah', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 40 },
    { id: '20260201001', name: 'Andrea Solorzano', role: 'employee', designation: 'Employee', project: 'VCC - D365 FO', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 38 },
    { id: '100678', name: 'Ashwath Soosainathan P', role: 'employee', designation: 'Employee', project: 'VCC - QA QC', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 33 },
    { id: 'ADM001', name: 'Kishore', role: 'admin', designation: 'Admin', project: null, start_date: '2023-01-01', end_date: null, hourly_rate: 0 },
    { id: 'ADM002', name: 'Gayathri Murugadas', role: 'admin', designation: 'Admin', project: null, start_date: '2023-01-01', end_date: null, hourly_rate: 0 },
    { id: 'FIN001', name: 'Finance Lead', role: 'finance', designation: 'Finance', project: null, start_date: '2024-01-01', end_date: null, hourly_rate: 0 },
  ];

  const projects = [
    'VCC - Salesforce', 'VCC - Web B2B', 'VCC - QA QC', 'VCC - JDE & EDI',
    'VCC - Partner Insight', 'VCC - IT Helpdesk Offshore', 'VCC - Enterprise Integration',
    'VCC - D365 FO', 'VCC - IT Support Savannah', 'VCC - IT Infra Onsite',
    'VCC - IT Infra PMO', 'VCC - Projects PMO', 'VCC - Zendesk',
    'VCC - BA - Onsite', 'VCC - Project Financial Services', 'VCC - IT Infra - 8x8',
  ];

  const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id, name, role, designation, project, start_date, end_date, hourly_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertProject = db.prepare(`INSERT OR IGNORE INTO projects (name) VALUES (?)`);
  const insertBalance = db.prepare(`INSERT OR IGNORE INTO leave_balances (user_id, leave_type, year, total_days, used_days) VALUES (?, ?, ?, ?, 0)`);

  const tx = db.transaction(() => {
    for (const u of users) {
      insertUser.run(u.id, u.name, u.role, u.designation, u.project, u.start_date, u.end_date, u.hourly_rate);
    }
    for (const p of projects) {
      insertProject.run(p);
    }
    for (const u of users.filter(u => u.role === 'employee')) {
      insertBalance.run(u.id, 'casual', 2026, 12);
      insertBalance.run(u.id, 'sick', 2026, 10);
      insertBalance.run(u.id, 'earned', 2026, 15);
    }
  });
  tx();

  console.log('Database seeded successfully');
}
