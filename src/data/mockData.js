import { startOfWeek, addDays, format } from 'date-fns';

export const PROJECTS = [
  'VCC - Salesforce',
  'VCC - Web B2B',
  'VCC - QA QC',
  'VCC - JDE & EDI',
  'VCC - Partner Insight',
  'VCC - IT Helpdesk Offshore',
  'VCC - Enterprise Integration',
  'VCC - D365 FO',
  'VCC - IT Support Savannah',
  'VCC - IT Infra Onsite',
  'VCC - IT Infra PMO',
  'VCC - Projects PMO',
  'VCC - Zendesk',
  'VCC - BA - Onsite',
  'VCC - Project Financial Services',
  'VCC - IT Infra - 8x8',
];

export const USERS = [
  { id: '100070', name: 'Pothiraja A', project: 'VCC - Enterprise Integration', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
  { id: '100459', name: 'Vivekanandan Jeevanantham', project: 'VCC - IT Helpdesk Offshore', role: 'employee', designation: 'Employee', startDate: '2025-01-12', endDate: '2026-12-31' },
  { id: '100530', name: 'Mohammed Navazuddin', project: 'VCC - Salesforce', role: 'employee', designation: 'Employee', startDate: '2025-11-01', endDate: '2026-12-31' },
  { id: '100637', name: 'K P Mohammed Arif', project: 'VCC - QA QC', role: 'employee', designation: 'Employee', startDate: '2025-01-12', endDate: '2026-12-31' },
  { id: '111103', name: 'Nishandhini Ashok Kumar', project: 'VCC - Salesforce', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
  { id: '100464', name: 'Balaji Padmanaban', project: 'VCC - Partner Insight', role: 'employee', designation: 'Employee', startDate: '2025-01-12', endDate: '2026-12-31' },
  { id: '100617', name: 'Vimal David', project: 'VCC - Web B2B', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
  { id: '100611', name: 'Sathishraj Rajendran', project: 'VCC - Web B2B', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
  { id: '100616', name: 'Jagadeesh Raju', project: 'VCC - Web B2B', role: 'employee', designation: 'Employee', startDate: '2026-03-30', endDate: '2026-12-31' },
  { id: '111104', name: 'Divya Priya', project: 'VCC - Salesforce', role: 'employee', designation: 'Employee', startDate: '2025-11-01', endDate: '2026-12-31' },
  { id: '100659', name: 'Bholeshankar Pandey', project: 'VCC - JDE & EDI', role: 'employee', designation: 'Employee', startDate: '2025-01-12', endDate: '2026-12-31' },
  { id: '100510', name: 'Kishore', project: 'VCC - Partner Insight', role: 'manager', designation: 'Manager', startDate: '2026-03-09', endDate: '2026-12-31' },
  { id: '20241001001', name: 'Dhiraj Gurang', project: 'VCC - IT Support Savannah', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
  { id: '20260201001', name: 'Andrea Solorzano', project: 'VCC - D365 FO', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
  { id: '100678', name: 'Ashwath Soosainathan P', project: 'VCC - QA QC', role: 'employee', designation: 'Employee', startDate: '2025-01-10', endDate: '2026-12-31' },
];

export const ADMIN_USER = {
  id: 'ADM001',
  name: 'Kishore',
  role: 'admin',
  designation: 'Admin',
};

export function getBiweeklyPeriods(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return [{
    start: firstDay,
    end: lastDay,
    label: `${format(firstDay, 'MMM')} 1 - ${format(firstDay, 'MMM')} ${lastDay.getDate()}, ${year}`,
  }];
}

// Fortnightly (14-day) periods aligned to a fixed Monday epoch.
// Epoch: Mon Jan 5, 2026. This gives Apr 13-26 as a period, matching payroll cycles.
export function getFortnightlyPeriods(year, month) {
  const EPOCH = new Date(2026, 0, 5); // Mon Jan 5 2026
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Find first period index that could overlap this month
  const diffMs = monthStart.getTime() - EPOCH.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let idx = Math.floor(diffDays / 14) - 1;
  if (idx < 0) idx = 0;

  const periods = [];
  for (let i = idx; ; i++) {
    const start = addDays(EPOCH, i * 14);
    const end = addDays(start, 13);
    if (start > monthEnd) break;
    if (end >= monthStart) {
      periods.push({
        start,
        end,
        label: `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`,
      });
    }
  }
  return periods;
}

export function getWeekRanges(periodStart, periodEnd) {
  const weeks = [];
  let current = startOfWeek(periodStart, { weekStartsOn: 1 });
  if (current < periodStart) current = periodStart;

  while (current <= periodEnd) {
    const weekStart = current;
    let weekEnd = addDays(startOfWeek(current, { weekStartsOn: 1 }), 6);
    if (weekEnd > periodEnd) weekEnd = periodEnd;

    weeks.push({
      start: new Date(weekStart),
      end: new Date(weekEnd),
      label: `${format(weekStart, 'EEE, MMM d')} - ${format(weekEnd, 'EEE, MMM d, yyyy')}`,
    });

    current = addDays(weekEnd, 1);
  }

  return weeks;
}

export function getDaysInRange(start, end) {
  const days = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
}

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Local / company holidays — add dates as 'YYYY-MM-DD' strings
export const HOLIDAYS = [
  '2026-04-23', // Local holiday
];

export function isNonWorkingDay(date) {
  if (isWeekend(date)) return true;
  const str = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return HOLIDAYS.includes(str);
}

export function getDefaultTimesheetKey(userId, periodLabel) {
  return `ts_${userId}_${periodLabel}`;
}
