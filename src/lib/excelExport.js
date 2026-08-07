import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getDaysInRange, isWeekend } from '../data/mockData';

const VENDOR_NAME = 'D4 Insight';

/**
 * Build a per-employee worksheet matching the sample Excel format:
 *   Date | Vendor Name | Contractor Name | Project Name | Work Item | Description | Hours
 *   ... one row per day ...
 *   (blank) | (blank) | (blank) | (blank) | (blank) | Billable Hours: | <total>
 */
function buildEmployeeSheet(emp, entries, periodStart, periodEnd) {
  const days = getDaysInRange(periodStart, periodEnd);
  const entryMap = {};
  entries.forEach((e) => { entryMap[e.date] = e; });

  const rows = [['Date', 'Vendor Name', 'Contractor Name', 'Project Name', 'Work Item', 'Description', 'Hours']];

  let totalHours = 0;
  days.forEach((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const displayDate = `${day.getMonth() + 1}/${day.getDate()}/${String(day.getFullYear()).slice(2)}`;
    const entry = entryMap[dateStr];
    const hrs = entry ? (parseFloat(entry.hours) || 0) : 0;
    const isWknd = isWeekend(day);
    const desc = entry?.description || (isWknd ? 'WEEKEND' : '');
    const workItem = entry?.work_item || '';
    totalHours += hrs;
    rows.push([displayDate, VENDOR_NAME, emp.name, emp.project || '', workItem, desc, hrs]);
  });

  // Billable Hours total row
  rows.push(['', '', '', '', '', 'Billable Hours:', totalHours]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // Date
    { wch: 14 }, // Vendor Name
    { wch: 28 }, // Contractor Name
    { wch: 28 }, // Project Name
    { wch: 24 }, // Work Item
    { wch: 40 }, // Description
    { wch: 8 },  // Hours
  ];

  return { ws, totalHours };
}

/**
 * Build the Summary worksheet:
 *   Sl.No | Project | Resource | Hours
 */
function buildSummarySheet(summaryRows) {
  const header = ['Sl.No', 'Project', 'Resource', 'Hours'];
  const rows = [header];
  summaryRows.forEach((r, i) => {
    rows.push([i + 1, r.project, r.name, r.hours]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // Sl.No
    { wch: 30 }, // Project
    { wch: 28 }, // Resource
    { wch: 10 }, // Hours
  ];
  return ws;
}

/**
 * Get a safe sheet name (max 31 chars, no special chars, unique).
 */
function getSheetName(name, usedNames) {
  // Use first name only
  let short = name.split(' ')[0].replace(/[\\/:*?[\]]/g, '').slice(0, 31);
  let final = short;
  let counter = 2;
  while (usedNames.has(final)) {
    final = `${short.slice(0, 28)}_${counter}`;
    counter++;
  }
  usedNames.add(final);
  return final;
}

/**
 * Generate a per-project Excel workbook.
 * Sheet 1 = Summary, then one sheet per employee.
 */
export function exportProjectExcel(projectName, employees, allTs, periodStart, periodEnd) {
  const wb = XLSX.utils.book_new();
  const startStr = format(periodStart, 'yyyy-MM-dd');
  const endStr = format(periodEnd, 'yyyy-MM-dd');
  const usedNames = new Set(['Summary']);
  const summaryRows = [];

  // Build employee sheets first to collect totals
  const empSheets = [];
  employees.forEach((emp) => {
    let entries = [];
    Object.entries(allTs).forEach(([key, ts]) => {
      if (!key.startsWith(`${emp.id}__`)) return;
      (ts.entries || []).forEach((e) => {
        if (e.date >= startStr && e.date <= endStr) entries.push(e);
      });
    });

    const sheetName = getSheetName(emp.name, usedNames);
    const { ws, totalHours } = buildEmployeeSheet(emp, entries, periodStart, periodEnd);
    empSheets.push({ sheetName, ws });
    summaryRows.push({ project: projectName, name: emp.name, hours: totalHours });
  });

  // Add Summary sheet first
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(summaryRows), 'Summary');

  // Add employee sheets
  empSheets.forEach(({ sheetName, ws }) => {
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const periodLabel = `${format(periodStart, 'dMMM')}To${format(periodEnd, 'dMMM_yyyy')}`;
  const safeName = projectName.replace(/[^a-zA-Z0-9_ -]/g, '').replace(/\s+/g, '_');
  const filename = `Timesheet_${safeName}_${periodLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Generate the full consolidated Excel workbook.
 * Sheet 1 = Summary (all projects), then one sheet per employee across all projects.
 * Also adds a "Project Summary" sheet with Project | Total Hours | No. of Resources.
 */
export function exportConsolidatedExcel(projectReports, allTs, periodStart, periodEnd) {
  const wb = XLSX.utils.book_new();
  const startStr = format(periodStart, 'yyyy-MM-dd');
  const endStr = format(periodEnd, 'yyyy-MM-dd');
  const usedNames = new Set(['Summary', 'Project Summary']);
  const summaryRows = [];
  const projectSummaryRows = [];
  const empSheets = [];

  Object.entries(projectReports).forEach(([projectName, data]) => {
    let projectHours = 0;
    let resourceCount = 0;

    data.employees.forEach((emp) => {
      let entries = [];
      Object.entries(allTs).forEach(([key, ts]) => {
        if (!key.startsWith(`${emp.id}__`)) return;
        (ts.entries || []).forEach((e) => {
          if (e.date >= startStr && e.date <= endStr) entries.push(e);
        });
      });

      const sheetName = getSheetName(emp.name, usedNames);
      const { ws, totalHours } = buildEmployeeSheet(emp, entries, periodStart, periodEnd);
      empSheets.push({ sheetName, ws });
      summaryRows.push({ project: projectName, name: emp.name, hours: totalHours });
      projectHours += totalHours;
      resourceCount++;
    });

    if (resourceCount > 0) {
      projectSummaryRows.push({ project: projectName, totalHours: projectHours, resources: resourceCount });
    }
  });

  // Summary sheet (Sl.No | Project | Resource | Hours)
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(summaryRows), 'Summary');

  // Project Summary sheet (Project | Total Hours | No. of Resources)
  const psHeader = ['Project', 'Total Hours', 'No. of Resources'];
  const psRows = [psHeader, ...projectSummaryRows.map((r) => [r.project, r.totalHours, r.resources])];
  const psWs = XLSX.utils.aoa_to_sheet(psRows);
  psWs['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, psWs, 'Project Summary');

  // Employee sheets
  empSheets.forEach(({ sheetName, ws }) => {
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const periodLabel = `${format(periodStart, 'dMMM')}To${format(periodEnd, 'dMMM_yyyy')}`;
  const filename = `Timesheet_VCC_Consolidated_${periodLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
}
