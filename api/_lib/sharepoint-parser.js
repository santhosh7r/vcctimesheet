// Parses the pivoted SharePoint "Reports to export" list structure.
// Each row = one employee's entire month, with columns 01-31 for each day.
// Entries are split into fortnightly (14-day) periods matching the app's payroll cycles.
//
// Column encoding pattern:
//   Day 01-09: _x0030_1, _x0030_2, ..., _x0030_9
//   Day 10-19: _x0031_0, _x0031_1, ..., _x0031_9
//   Day 20-29: _x0032_0, _x0032_1, ..., _x0032_9
//   Day 30-31: _x0033_0, _x0033_1
//
// Each day has suffixes: (none)=Date, Description, Hours, Workitem, Status

const MONTH_MAP = {
  January: 0, February: 1, March: 2, April: 3,
  May: 4, June: 5, July: 6, August: 7,
  September: 8, October: 9, November: 10, December: 11,
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Fortnightly period calculation — must match src/data/mockData.js getFortnightlyPeriods
const EPOCH = new Date(2026, 0, 5); // Mon Jan 5, 2026

function addDaysToDate(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFortnightlyPeriodsForMonth(year, monthIndex) {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const diffMs = monthStart.getTime() - EPOCH.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let idx = Math.floor(diffDays / 14) - 1;
  if (idx < 0) idx = 0;

  const periods = [];
  for (let i = idx; ; i++) {
    const start = addDaysToDate(EPOCH, i * 14);
    const end = addDaysToDate(start, 13);
    if (start > monthEnd) break;
    if (end >= monthStart) {
      const label = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} - ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
      periods.push({ start: formatDateStr(start), end: formatDateStr(end), label });
    }
  }
  return periods;
}

function getDayColumnPrefix(day) {
  const tens = Math.floor(day / 10);
  const ones = day % 10;
  return `_x003${tens}_${ones}`;
}

export function parseSharePointRow(fields) {
  const employeeId = fields.EmployeeID;
  const employeeName = fields.Title;
  const email = fields.Employeemailaddress;
  const project = fields.ProjectNames;
  const monthName = fields.Month;
  const year = parseInt(fields.Year, 10);

  if (!employeeId || !monthName || !year) return null;

  const monthIndex = MONTH_MAP[monthName];
  if (monthIndex === undefined) return null;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Parse all day entries from the row
  const allEntries = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const prefix = getDayColumnPrefix(day);

    const description = fields[`${prefix}Description`] || '';
    // Hours column: try standard "XXHours" suffix first, then fall back to
    // standalone prefix (e.g. "15 Hours" has internal name "_x0031_5" not "_x0031_5Hours")
    let hours = parseFloat(fields[`${prefix}Hours`]);
    if (isNaN(hours)) {
      const standalone = fields[prefix];
      hours = (typeof standalone === 'number') ? standalone : 0;
    }
    const workItem = fields[`${prefix}Workitem`] || '';
    const status = fields[`${prefix}Status`] || '';

    if (!hours && !description && !workItem) continue;

    // Always compute date from year/month/day loop counter — SharePoint date
    // columns are stored in IST (UTC+5:30) so naive UTC conversion shifts by -1 day.
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const dayDate = new Date(year, monthIndex, day);
    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

    allEntries.push({
      date: dateStr,
      day_name: dayName,
      work_item: workItem,
      description,
      hours,
      status,
    });
  }

  // Split entries into fortnightly periods matching the app's payroll cycles
  const fortnightlyPeriods = getFortnightlyPeriodsForMonth(year, monthIndex);
  const results = [];

  for (const period of fortnightlyPeriods) {
    const periodEntries = allEntries.filter(e => e.date >= period.start && e.date <= period.end);
    if (periodEntries.length === 0) continue;

    results.push({
      employeeId,
      employeeName,
      email,
      project,
      monthName,
      year,
      periodLabel: period.label,
      entries: periodEntries,
    });
  }

  return results;
}
