import { format, subDays, addDays } from 'date-fns';

const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');

// ── Users ──
export const users = [
  { id: '100070', name: 'Pothiraja A', role: 'employee', designation: 'Employee', project: 'VCC - Enterprise Integration', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 32, is_active: 1, email: 'pothiraja@d4insight.com', phone: '+91-9876543210' },
  { id: '100459', name: 'Vivekanandan Jeevanantham', role: 'employee', designation: 'Employee', project: 'VCC - IT Helpdesk Offshore', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 30, is_active: 1, email: 'vivek@d4insight.com', phone: '+91-9876543211' },
  { id: '100530', name: 'Mohammed Navazuddin', role: 'employee', designation: 'Employee', project: 'VCC - Salesforce', start_date: '2025-11-01', end_date: '2026-12-31', hourly_rate: 35, is_active: 1, email: 'navaz@d4insight.com', phone: '+91-9876543212' },
  { id: '100637', name: 'K P Mohammed Arif', role: 'employee', designation: 'Employee', project: 'VCC - QA QC', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 33, is_active: 1, email: 'arif@d4insight.com', phone: '+91-9876543213' },
  { id: '111103', name: 'Nishandhini Ashok Kumar', role: 'employee', designation: 'Employee', project: 'VCC - Salesforce', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 32, is_active: 1, email: 'nishandhini@d4insight.com', phone: '+91-9876543214' },
  { id: '100464', name: 'Balaji Padmanaban', role: 'employee', designation: 'Employee', project: 'VCC - Partner Insight', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 33, is_active: 1, email: 'balaji@d4insight.com', phone: '+91-9876543215' },
  { id: '100617', name: 'Vimal David', role: 'employee', designation: 'Employee', project: 'VCC - Web B2B', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 39, is_active: 1, email: 'vimal@d4insight.com', phone: '+91-9876543216' },
  { id: '100611', name: 'Sathishraj Rajendran', role: 'employee', designation: 'Employee', project: 'VCC - Web B2B', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 39, is_active: 1, email: 'sathish@d4insight.com', phone: '+91-9876543217' },
  { id: '100616', name: 'Jagadeesh Raju', role: 'employee', designation: 'Employee', project: 'VCC - Web B2B', start_date: '2026-03-30', end_date: '2026-12-31', hourly_rate: 39, is_active: 1, email: 'jagadeesh@d4insight.com', phone: '+91-9876543218' },
  { id: '111104', name: 'Divya Priya', role: 'employee', designation: 'Employee', project: 'VCC - Salesforce', start_date: '2025-11-01', end_date: '2026-12-31', hourly_rate: 35, is_active: 1, email: 'divya@d4insight.com', phone: '+91-9876543219' },
  { id: '100659', name: 'Bholeshankar Pandey', role: 'employee', designation: 'Employee', project: 'VCC - JDE & EDI', start_date: '2025-01-12', end_date: '2026-12-31', hourly_rate: 37, is_active: 1, email: 'bhole@d4insight.com', phone: '+91-9876543220' },
  { id: '100510', name: 'Kishore', role: 'manager', designation: 'Manager', project: 'VCC - Partner Insight', start_date: '2026-03-09', end_date: '2026-12-31', hourly_rate: 35, is_active: 1, email: 'kishore@d4insight.com', phone: '+91-9876543221' },
  { id: '20241001001', name: 'Dhiraj Gurang', role: 'employee', designation: 'Employee', project: 'VCC - IT Support Savannah', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 65, is_active: 1, email: 'dhiraj@d4insight.com', phone: '+1-5551234567' },
  { id: '20260201001', name: 'Andrea Solorzano', role: 'employee', designation: 'Employee', project: 'VCC - D365 FO', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 0, is_active: 1, email: 'andrea@d4insight.com', phone: '+1-5551234568' },
  { id: '100678', name: 'Ashwath Soosainathan P', role: 'employee', designation: 'Employee', project: 'VCC - QA QC', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 0, is_active: 1, email: 'ashwath@d4insight.com', phone: '+91-9876543222' },
  { id: '100048', name: 'Krupa Pankaj Vyas', role: 'employee', designation: 'Employee', project: 'VCC - D365 FO', start_date: '2025-01-10', end_date: '2026-12-31', hourly_rate: 38, is_active: 1, email: 'krupa.vyas@d4insight.com', phone: '+91-9876543223' },
  { id: 'ADM001', name: 'Kishore', role: 'admin', designation: 'Admin', project: null, start_date: '2023-01-01', end_date: null, hourly_rate: 0, is_active: 1, email: 'kishore@d4insight.com', phone: '+91-9876543200' },
  { id: 'ADM002', name: 'Gayathri Murugadas', role: 'admin', designation: 'Admin', project: null, start_date: '2023-01-01', end_date: null, hourly_rate: 0, is_active: 1, email: 'gayathri.m@d4insight.com', phone: '+91-9876543202' },
  { id: 'FIN001', name: 'Finance Lead', role: 'finance', designation: 'Finance', project: null, start_date: '2024-01-01', end_date: null, hourly_rate: 0, is_active: 1, email: 'finance@d4insight.com', phone: '+91-9876543201' },
];

// ── Projects ──
export const projects = [
  'VCC - Salesforce', 'VCC - Web B2B', 'VCC - QA QC', 'VCC - JDE & EDI',
  'VCC - Partner Insight', 'VCC - IT Helpdesk Offshore', 'VCC - Enterprise Integration',
  'VCC - D365 FO', 'VCC - IT Support Savannah', 'VCC - IT Infra Onsite',
  'VCC - IT Infra PMO', 'VCC - Projects PMO', 'VCC - Zendesk',
  'VCC - BA - Onsite', 'VCC - Project Financial Services', 'VCC - IT Infra - 8x8',
];

// ── Clients (finance billing) ──
export const clients = [
  { id: 'CLT001', name: 'Visual Comfort Company', region: 'USA', contact_name: 'VCC Finance', contact_email: 'finance@visualcomfort.com', status: 'active', notes: 'Primary client — all VCC projects', created_at: '2024-01-01T00:00:00Z' },
];

// ── Billable Projects (per-project rate cards) ──
export const billableProjects = projects.map((name, i) => ({
  id: `BP${String(i + 1).padStart(3, '0')}`,
  name,
  client_id: 'CLT001',
  billing_type: 'hourly',
  bill_rate: [45, 55, 50, 48, 55, 38, 50, 60, 60, 65, 70, 65, 42, 75, 80, 50][i] || 50,
  currency: 'USD',
  status: 'active',
  notes: '',
  created_at: '2024-01-01T00:00:00Z',
}));

// ── SOWs (sample workflow at multiple stages) ──
export const sows = [
  {
    id: 1, sow_number: 'SOW-2026-0007', client_id: 'CLT001', project_id: 'BP005',
    title: 'Partner Insight – New Resource: Senior Consultant',
    sow_type: 'resource', description: 'Adding 1 Senior Technical Consultant to the Partner Insight engagement to accelerate phase 2 delivery.',
    contract_value: 124800, currency: 'USD',
    start_date: '2026-06-01', end_date: '2026-12-31', status: 'submitted_for_finance',
    resource_name: 'Arun Joseph Arulsekar', resource_role: 'Senior Technical Consultant', resource_rate: 60,
    finance_approved_by: null, finance_approved_at: null, finance_notes: null,
    manager_signed_by: null, manager_signed_at: null, docusign_envelope_id: null, docusign_status: null,
    rejected_by: null, rejected_at: null, rejection_reason: null,
    created_by: 'ADM001', created_at: '2026-05-08T10:30:00Z', updated_at: '2026-05-08T10:30:00Z',
  },
  {
    id: 2, sow_number: 'SOW-2026-0006', client_id: 'CLT001', project_id: 'BP002',
    title: 'Web B2B – Q3 Module Expansion',
    sow_type: 'project', description: 'Build out the customer self-service portal as an additional module on Web B2B. 4-month engagement, 3 resources.',
    contract_value: 248000, currency: 'USD',
    start_date: '2026-07-01', end_date: '2026-10-31', status: 'sent_for_signature',
    resource_name: null, resource_role: null, resource_rate: null,
    finance_approved_by: 'CLI001', finance_approved_at: '2026-05-05T14:20:00Z', finance_notes: 'Approved — within budget.',
    manager_signed_by: null, manager_signed_at: null,
    docusign_envelope_id: 'DEMO-DS-7392-A1', docusign_status: 'sent',
    rejected_by: null, rejected_at: null, rejection_reason: null,
    created_by: 'ADM001', created_at: '2026-04-28T09:00:00Z', updated_at: '2026-05-05T14:20:00Z',
  },
  {
    id: 3, sow_number: 'SOW-2026-0005', client_id: 'CLT001', project_id: 'BP001',
    title: 'Salesforce – Integration Phase 3',
    sow_type: 'project', description: 'Integration of Salesforce with NetSuite ERP. 6-month phase 3.',
    contract_value: 380000, currency: 'USD',
    start_date: '2026-04-01', end_date: '2026-09-30', status: 'active',
    resource_name: null, resource_role: null, resource_rate: null,
    finance_approved_by: 'CLI001', finance_approved_at: '2026-03-15T11:00:00Z', finance_notes: '',
    manager_signed_by: 'CLI002', manager_signed_at: '2026-03-22T16:45:00Z',
    docusign_envelope_id: 'DEMO-DS-7341-B2', docusign_status: 'completed',
    rejected_by: null, rejected_at: null, rejection_reason: null,
    created_by: 'ADM001', created_at: '2026-03-10T08:00:00Z', updated_at: '2026-03-22T16:45:00Z',
  },
  {
    id: 4, sow_number: 'SOW-2026-0004', client_id: 'CLT001', project_id: null,
    title: 'IT Helpdesk Offshore – Rate Card Amendment',
    sow_type: 'amendment', description: 'Annual rate adjustment of +6% on the IT Helpdesk Offshore engagement.',
    contract_value: 12000, currency: 'USD',
    start_date: '2026-05-01', end_date: '2027-04-30', status: 'finance_approved',
    resource_name: null, resource_role: null, resource_rate: null,
    finance_approved_by: 'CLI001', finance_approved_at: '2026-05-09T13:10:00Z', finance_notes: 'CPI-aligned, OK.',
    manager_signed_by: null, manager_signed_at: null,
    docusign_envelope_id: null, docusign_status: null,
    rejected_by: null, rejected_at: null, rejection_reason: null,
    created_by: 'FIN001', created_at: '2026-05-02T09:00:00Z', updated_at: '2026-05-09T13:10:00Z',
  },
];

// ── Holidays (India + US 2026) ──
export const holidays = [
  { id: 1, holiday_date: '2026-01-01', country: 'IN', name: 'New Year\'s Day' },
  { id: 2, holiday_date: '2026-01-26', country: 'IN', name: 'Republic Day' },
  { id: 3, holiday_date: '2026-03-06', country: 'IN', name: 'Holi' },
  { id: 4, holiday_date: '2026-03-21', country: 'IN', name: 'Eid al-Fitr' },
  { id: 5, holiday_date: '2026-04-03', country: 'IN', name: 'Good Friday' },
  { id: 6, holiday_date: '2026-04-14', country: 'IN', name: 'Ambedkar Jayanti' },
  { id: 7, holiday_date: '2026-05-01', country: 'IN', name: 'Labour Day' },
  { id: 8, holiday_date: '2026-05-27', country: 'IN', name: 'Eid al-Adha' },
  { id: 9, holiday_date: '2026-08-15', country: 'IN', name: 'Independence Day' },
  { id: 10, holiday_date: '2026-08-26', country: 'IN', name: 'Janmashtami' },
  { id: 11, holiday_date: '2026-10-02', country: 'IN', name: 'Gandhi Jayanti' },
  { id: 12, holiday_date: '2026-10-20', country: 'IN', name: 'Dussehra' },
  { id: 13, holiday_date: '2026-11-08', country: 'IN', name: 'Diwali' },
  { id: 14, holiday_date: '2026-11-25', country: 'IN', name: 'Guru Nanak Jayanti' },
  { id: 15, holiday_date: '2026-12-25', country: 'IN', name: 'Christmas Day' },
  { id: 16, holiday_date: '2026-01-01', country: 'US', name: 'New Year\'s Day' },
  { id: 17, holiday_date: '2026-01-19', country: 'US', name: 'Martin Luther King Jr. Day' },
  { id: 18, holiday_date: '2026-02-16', country: 'US', name: 'Presidents\' Day' },
  { id: 19, holiday_date: '2026-05-25', country: 'US', name: 'Memorial Day' },
  { id: 20, holiday_date: '2026-06-19', country: 'US', name: 'Juneteenth' },
  { id: 21, holiday_date: '2026-07-03', country: 'US', name: 'Independence Day (observed)' },
  { id: 22, holiday_date: '2026-09-07', country: 'US', name: 'Labor Day' },
  { id: 23, holiday_date: '2026-10-12', country: 'US', name: 'Columbus Day' },
  { id: 24, holiday_date: '2026-11-11', country: 'US', name: 'Veterans Day' },
  { id: 25, holiday_date: '2026-11-26', country: 'US', name: 'Thanksgiving Day' },
  { id: 26, holiday_date: '2026-11-27', country: 'US', name: 'Day after Thanksgiving' },
  { id: 27, holiday_date: '2026-12-25', country: 'US', name: 'Christmas Day' },
];

// ── Invoices (sample) ──
export const invoices = [
  {
    id: 1, invoice_number: 'INV-2026-0001', client_id: 'CLT001',
    period_start: '2026-04-01', period_end: '2026-04-15',
    issue_date: '2026-04-16', due_date: '2026-05-16',
    currency: 'USD', subtotal: 0, total_amount: 0,
    status: 'sent', paid_at: null, notes: 'Bi-weekly billing — Apr first half',
    created_by: 'FIN001', created_at: '2026-04-16T09:00:00Z', updated_at: '2026-04-16T09:00:00Z',
    lines: [],
  },
];

// ── Leave Balances ──
export const leaveBalances = users.filter(u => u.role === 'employee').flatMap(u => [
  { id: `${u.id}_casual`, user_id: u.id, leave_type: 'casual', year: 2026, total_days: 12, used_days: Math.floor(Math.random() * 5) },
  { id: `${u.id}_sick`, user_id: u.id, leave_type: 'sick', year: 2026, total_days: 10, used_days: Math.floor(Math.random() * 3) },
  { id: `${u.id}_earned`, user_id: u.id, leave_type: 'earned', year: 2026, total_days: 15, used_days: Math.floor(Math.random() * 4) },
]);

// ── Leaves ──
const employeeIds = users.filter(u => u.role === 'employee').map(u => u.id);
export const leaves = [
  { id: 1, user_id: '100070', user_name: 'Pothiraja A', leave_type: 'casual', start_date: '2026-04-10', end_date: '2026-04-11', days_count: 2, reason: 'Family function', status: 'approved', approved_by: '100510', approved_at: '2026-04-08', created_at: '2026-04-05' },
  { id: 2, user_id: '100459', user_name: 'Vivekanandan Jeevanantham', leave_type: 'sick', start_date: '2026-04-14', end_date: '2026-04-14', days_count: 1, reason: 'Fever', status: 'approved', approved_by: '100510', approved_at: '2026-04-13', created_at: '2026-04-13' },
  { id: 3, user_id: '100530', user_name: 'Mohammed Navazuddin', leave_type: 'earned', start_date: '2026-04-28', end_date: '2026-04-30', days_count: 3, reason: 'Vacation trip', status: 'pending', approved_by: null, approved_at: null, created_at: '2026-04-20' },
  { id: 4, user_id: '111103', user_name: 'Nishandhini Ashok Kumar', leave_type: 'casual', start_date: '2026-04-21', end_date: '2026-04-21', days_count: 1, reason: 'Personal work', status: 'approved', approved_by: '100510', approved_at: '2026-04-19', created_at: '2026-04-18' },
  { id: 5, user_id: '100617', user_name: 'Vimal David', leave_type: 'wfh', start_date: '2026-04-22', end_date: '2026-04-22', days_count: 1, reason: 'Internet setup at new home', status: 'pending', approved_by: null, approved_at: null, created_at: '2026-04-20' },
  { id: 6, user_id: '100637', user_name: 'K P Mohammed Arif', leave_type: 'sick', start_date: '2026-03-25', end_date: '2026-03-26', days_count: 2, reason: 'Medical appointment', status: 'approved', approved_by: '100510', approved_at: '2026-03-24', created_at: '2026-03-23' },
  { id: 7, user_id: '100464', user_name: 'Balaji Padmanaban', leave_type: 'casual', start_date: '2026-05-01', end_date: '2026-05-02', days_count: 2, reason: 'Family event', status: 'pending', approved_by: null, approved_at: null, created_at: '2026-04-22' },
  { id: 8, user_id: '100659', user_name: 'Bholeshankar Pandey', leave_type: 'earned', start_date: '2026-03-10', end_date: '2026-03-12', days_count: 3, reason: 'Travel', status: 'rejected', approved_by: '100510', approved_at: '2026-03-08', created_at: '2026-03-05' },
];

// ── Tasks ──
const taskTitles = [
  'Review API documentation', 'Fix login bug on staging', 'Update unit tests',
  'Deploy to UAT', 'Code review for PR #45', 'Update Salesforce integration',
  'Database migration script', 'Write technical spec', 'Performance optimization',
  'Setup CI/CD pipeline', 'Client demo preparation', 'Bug triage meeting',
  'Update dependency versions', 'Create data backup script', 'Implement search feature',
];
const taskStatuses = ['pending', 'in_progress', 'completed', 'completed', 'in_progress', 'pending', 'completed'];
const taskPriorities = ['low', 'medium', 'medium', 'high', 'urgent', 'medium', 'high'];

let taskId = 1;
export const tasks = employeeIds.slice(0, 8).flatMap((userId, idx) => {
  const userName = users.find(u => u.id === userId).name;
  return Array.from({ length: 3 }, (_, i) => {
    const status = taskStatuses[(idx + i) % taskStatuses.length];
    const d = format(subDays(today, (idx * 2 + i) % 14), 'yyyy-MM-dd');
    return {
      id: taskId++,
      user_id: userId,
      user_name: userName,
      assigned_by: '100510',
      assigned_by_name: 'Kishore',
      title: taskTitles[(idx * 3 + i) % taskTitles.length],
      description: 'Demo task description for testing purposes.',
      date: d,
      priority: taskPriorities[(idx + i) % taskPriorities.length],
      status,
      estimated_hours: 4 + (i * 2),
      actual_hours: status === 'completed' ? 3 + i * 2 : null,
      completed_at: status === 'completed' ? d : null,
      created_at: d,
      updated_at: d,
    };
  });
});

// ── Timesheets ──
export const timesheets = employeeIds.slice(0, 6).map((userId, idx) => {
  const userName = users.find(u => u.id === userId).name;
  const userProject = users.find(u => u.id === userId).project;
  const periodLabel = 'Apr 1 - Apr 15, 2026';
  const entries = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(2026, 3, 1 + i);
    const dayName = format(d, 'EEEE');
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return {
      id: idx * 10 + i + 1,
      date: format(d, 'yyyy-MM-dd'),
      day_name: dayName,
      work_item: isWeekend ? '' : userProject,
      description: isWeekend ? '' : 'Regular work activities',
      hours: isWeekend ? 0 : 8,
    };
  });
  return {
    id: idx + 1,
    user_id: userId,
    user_name: userName,
    user_project: userProject,
    period_label: periodLabel,
    status: idx < 3 ? 'submitted' : 'saved',
    updated_at: '2026-04-15T10:00:00Z',
    entries,
  };
});

// ── Documents ──
export const documents = [
  { id: 1, user_id: '100070', doc_type: 'offer_letter', original_name: 'Offer_Letter_Pothiraja.pdf', stored_name: 'doc_1.pdf', file_size: 245000, mime_type: 'application/pdf', uploaded_by: 'ADM001', uploaded_at: '2025-02-15' },
  { id: 2, user_id: '100070', doc_type: 'sow', original_name: 'SOW_Enterprise_Integration.pdf', stored_name: 'doc_2.pdf', file_size: 520000, mime_type: 'application/pdf', uploaded_by: 'ADM001', uploaded_at: '2025-02-20' },
  { id: 3, user_id: '100459', doc_type: 'contract', original_name: 'Contract_Vivek.pdf', stored_name: 'doc_3.pdf', file_size: 310000, mime_type: 'application/pdf', uploaded_by: 'ADM001', uploaded_at: '2025-03-01' },
  { id: 4, user_id: '100530', doc_type: 'offer_letter', original_name: 'Offer_Navaz.pdf', stored_name: 'doc_4.pdf', file_size: 198000, mime_type: 'application/pdf', uploaded_by: 'ADM001', uploaded_at: '2025-11-05' },
  { id: 5, user_id: '100617', doc_type: 'sow', original_name: 'SOW_Web_B2B.pdf', stored_name: 'doc_5.pdf', file_size: 450000, mime_type: 'application/pdf', uploaded_by: 'ADM001', uploaded_at: '2025-01-15' },
  { id: 6, user_id: '100510', doc_type: 'contract', original_name: 'Contract_Kishore.pdf', stored_name: 'doc_6.pdf', file_size: 280000, mime_type: 'application/pdf', uploaded_by: 'ADM001', uploaded_at: '2026-03-15' },
];

// ── Frozen Periods ──
export const frozenPeriods = [
  { id: 1, period_label: 'Mar 1 - Mar 15, 2026', project: null, frozen_at: '2026-03-20' },
  { id: 2, period_label: 'Mar 16 - Mar 31, 2026', project: null, frozen_at: '2026-04-05' },
];

// ── Requirements ──
export const requirements = [
  { id: 1, title: 'Senior Salesforce Developer', description: 'Need an experienced Salesforce developer with Lightning Web Components expertise.', project: 'VCC - Salesforce', location_type: 'offshore', location_detail: 'Chennai, India', positions_count: 2, skills: 'Salesforce, Apex, LWC, SOQL', status: 'open', priority: 'high', created_by: 'ADM001', created_at: '2026-03-15', updated_at: '2026-03-15' },
  { id: 2, title: 'QA Automation Engineer', description: 'Selenium and Cypress automation testing engineer needed.', project: 'VCC - QA QC', location_type: 'offshore', location_detail: 'Bangalore, India', positions_count: 1, skills: 'Selenium, Cypress, JavaScript, TestNG', status: 'open', priority: 'medium', created_by: 'ADM001', created_at: '2026-03-20', updated_at: '2026-03-20' },
  { id: 3, title: 'Full Stack Developer', description: 'React + Node.js developer for B2B web platform.', project: 'VCC - Web B2B', location_type: 'hybrid', location_detail: 'Savannah, GA / Remote', positions_count: 1, skills: 'React, Node.js, PostgreSQL, AWS', status: 'open', priority: 'urgent', created_by: 'ADM001', created_at: '2026-04-01', updated_at: '2026-04-01' },
  { id: 4, title: 'D365 Functional Consultant', description: 'Finance and Operations module consultant.', project: 'VCC - D365 FO', location_type: 'onsite', location_detail: 'Savannah, GA', positions_count: 1, skills: 'D365 FO, Finance Module, X++', status: 'closed', priority: 'medium', created_by: 'ADM001', created_at: '2026-02-10', updated_at: '2026-03-30' },
  { id: 5, title: 'IT Helpdesk Technician', description: 'L1/L2 support technician for offshore helpdesk.', project: 'VCC - IT Helpdesk Offshore', location_type: 'offshore', location_detail: 'Chennai, India', positions_count: 3, skills: 'Windows, Active Directory, ServiceNow, Networking', status: 'open', priority: 'medium', created_by: 'ADM001', created_at: '2026-04-10', updated_at: '2026-04-10' },
];

// ── Meetings ──
export const meetings = [
  { id: 1, title: 'Sprint Planning - Web B2B', date: '2026-04-21', time: '10:00', attendees: JSON.stringify(['100617', '100611', '100616']), notes: 'Discussed upcoming sprint goals. Prioritized the checkout flow redesign and API performance improvements.', project: 'VCC - Web B2B', created_by: '100510', created_by_name: 'Kishore', created_at: '2026-04-21', updated_at: '2026-04-21' },
  { id: 2, title: 'Salesforce Integration Review', date: '2026-04-18', time: '14:30', attendees: JSON.stringify(['100530', '111103', '111104']), notes: 'Reviewed the new CPQ integration. Found 3 blocking issues that need resolution before UAT.', project: 'VCC - Salesforce', created_by: '100510', created_by_name: 'Kishore', created_at: '2026-04-18', updated_at: '2026-04-18' },
  { id: 3, title: 'Weekly Standup - QA Team', date: '2026-04-22', time: '09:30', attendees: JSON.stringify(['100637', '100678']), notes: 'Discussed test coverage goals for Q2. Agreed to increase automation coverage to 70%.', project: 'VCC - QA QC', created_by: '100510', created_by_name: 'Kishore', created_at: '2026-04-22', updated_at: '2026-04-22' },
  { id: 4, title: 'Client Demo Preparation', date: '2026-04-23', time: '11:00', attendees: JSON.stringify(['100070', '100464']), notes: 'Prepared demo environment. Need to fix data seeding script before Thursday demo.', project: 'VCC - Enterprise Integration', created_by: '100510', created_by_name: 'Kishore', created_at: '2026-04-23', updated_at: '2026-04-23' },
];

// ── Meeting Actions ──
export const meetingActions = [
  { id: 1, meeting_id: 1, description: 'Complete checkout flow wireframes', assigned_to: '100617', assigned_to_name: 'Vimal David', due_date: '2026-04-25', status: 'in_progress', completed_at: null, created_at: '2026-04-21' },
  { id: 2, meeting_id: 1, description: 'Setup performance benchmarks', assigned_to: '100611', assigned_to_name: 'Sathishraj Rajendran', due_date: '2026-04-28', status: 'open', completed_at: null, created_at: '2026-04-21' },
  { id: 3, meeting_id: 2, description: 'Fix CPQ pricing calculation bug', assigned_to: '100530', assigned_to_name: 'Mohammed Navazuddin', due_date: '2026-04-22', status: 'completed', completed_at: '2026-04-21', created_at: '2026-04-18' },
  { id: 4, meeting_id: 2, description: 'Update integration test suite', assigned_to: '111103', assigned_to_name: 'Nishandhini Ashok Kumar', due_date: '2026-04-24', status: 'open', completed_at: null, created_at: '2026-04-18' },
  { id: 5, meeting_id: 3, description: 'Add Cypress tests for login module', assigned_to: '100637', assigned_to_name: 'K P Mohammed Arif', due_date: '2026-04-29', status: 'open', completed_at: null, created_at: '2026-04-22' },
];

// ── Sales Deals ──
export const salesDeals = [
  { id: 1, title: 'Enterprise CRM Implementation', client_name: 'Acme Corp', deal_value: 150000, currency: 'USD', stage: 'proposal', probability: 60, expected_close_date: '2026-06-30', owner_id: 'ADM001', notes: 'Large enterprise deal. Client comparing us with 2 other vendors.', created_at: '2026-02-15', updated_at: '2026-04-10' },
  { id: 2, title: 'IT Support Services - Annual', client_name: 'TechFlow Inc', deal_value: 85000, currency: 'USD', stage: 'negotiation', probability: 75, expected_close_date: '2026-05-15', owner_id: 'ADM001', notes: 'Renewal deal. Client happy with current service.', created_at: '2026-03-01', updated_at: '2026-04-18' },
  { id: 3, title: 'Salesforce Migration', client_name: 'Global Retail Co', deal_value: 220000, currency: 'USD', stage: 'qualified', probability: 40, expected_close_date: '2026-08-31', owner_id: 'ADM001', notes: 'Migrating from legacy CRM to Salesforce.', created_at: '2026-03-20', updated_at: '2026-04-05' },
  { id: 4, title: 'Web Portal Development', client_name: 'StartUp Labs', deal_value: 65000, currency: 'USD', stage: 'closed_won', probability: 100, expected_close_date: '2026-03-31', owner_id: 'ADM001', notes: 'Deal closed! Project starts May 2026.', created_at: '2026-01-10', updated_at: '2026-03-28' },
  { id: 5, title: 'D365 Implementation Phase 2', client_name: 'Manufacturing Plus', deal_value: 180000, currency: 'USD', stage: 'prospect', probability: 20, expected_close_date: '2026-09-30', owner_id: 'ADM001', notes: 'Follow-up from Phase 1. Client exploring budget.', created_at: '2026-04-01', updated_at: '2026-04-15' },
  { id: 6, title: 'QA Outsourcing Contract', client_name: 'FinServ Group', deal_value: 120000, currency: 'USD', stage: 'closed_lost', probability: 0, expected_close_date: '2026-04-15', owner_id: 'ADM001', notes: 'Lost to competitor on pricing.', created_at: '2026-02-01', updated_at: '2026-04-15' },
];

// ── Nine Box Placements ──
export const nineboxPlacements = [
  { id: 1, user_id: '100070', user_name: 'Pothiraja A', hourly_rate: 37, project: 'VCC - Enterprise Integration', potential: 'high', performance: 'high', period: 'Q1 2026', notes: 'Top performer. Ready for leadership role.', placed_by: 'ADM001', placed_at: '2026-04-01' },
  { id: 2, user_id: '100617', user_name: 'Vimal David', hourly_rate: 39, project: 'VCC - Web B2B', potential: 'high', performance: 'medium', period: 'Q1 2026', notes: 'High potential, needs more challenging projects.', placed_by: 'ADM001', placed_at: '2026-04-01' },
  { id: 3, user_id: '100530', user_name: 'Mohammed Navazuddin', hourly_rate: 35, project: 'VCC - Salesforce', potential: 'medium', performance: 'high', period: 'Q1 2026', notes: 'Consistent performer. Strong technical skills.', placed_by: 'ADM001', placed_at: '2026-04-01' },
  { id: 4, user_id: '100637', user_name: 'K P Mohammed Arif', hourly_rate: 33, project: 'VCC - QA QC', potential: 'medium', performance: 'medium', period: 'Q1 2026', notes: 'Steady contributor. Consider training opportunities.', placed_by: 'ADM001', placed_at: '2026-04-01' },
  { id: 5, user_id: '100459', user_name: 'Vivekanandan Jeevanantham', hourly_rate: 33, project: 'VCC - IT Helpdesk Offshore', potential: 'low', performance: 'high', period: 'Q1 2026', notes: 'Reliable in current role. Good domain expertise.', placed_by: 'ADM001', placed_at: '2026-04-01' },
  { id: 6, user_id: '111103', user_name: 'Nishandhini Ashok Kumar', hourly_rate: 33, project: 'VCC - Salesforce', potential: 'high', performance: 'medium', period: 'Q1 2026', notes: 'Fast learner. Mentorship recommended.', placed_by: 'ADM001', placed_at: '2026-04-01' },
  { id: 7, user_id: '100464', user_name: 'Balaji Padmanaban', hourly_rate: 33, project: 'VCC - Partner Insight', potential: 'medium', performance: 'low', period: 'Q1 2026', notes: 'Needs performance improvement plan.', placed_by: 'ADM001', placed_at: '2026-04-01' },
];
