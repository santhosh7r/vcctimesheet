import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Download, FileSpreadsheet, FileBarChart, AlertTriangle, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useTimesheets } from '../../context/TimesheetContext';
import { getFortnightlyPeriods, getDaysInRange, isNonWorkingDay } from '../../data/mockData';
import { exportProjectExcel, exportConsolidatedExcel } from '../../lib/excelExport';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';

export default function Reports() {
  const { getAllTimesheets, employees: allEmployees, projects: PROJECTS } = useTimesheets();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [periodIndex, setPeriodIndex] = useState(0);
  const [projectFilter, setProjectFilter] = useState('');
  const [activeTab, setActiveTab] = useState('date-wise');

  const periods = getFortnightlyPeriods(year, month);
  const currentPeriod = periods[periodIndex] || periods[0];
  const allTs = getAllTimesheets();
  const employees = allEmployees.filter((u) => u.role === 'employee' && !u.is_archived && u.is_active !== false);

  const tabs = [
    { key: 'date-wise', label: 'Date-wise Report' },
    { key: 'period-wise', label: 'Period-wise Report' },
    { key: 'individual', label: 'Individual Reports' },
    { key: 'validation', label: 'Validation' },
  ];

  const projectReports = useMemo(() => {
    if (!currentPeriod) return {};
    const startStr = format(currentPeriod.start, 'yyyy-MM-dd');
    const endStr = format(currentPeriod.end, 'yyyy-MM-dd');
    const weekdays = getDaysInRange(currentPeriod.start, currentPeriod.end)
      .filter((d) => !isNonWorkingDay(d))
      .map((d) => format(d, 'yyyy-MM-dd'));
    const reports = {};
    PROJECTS.forEach((project) => {
      const emps = employees.filter((e) => e.project === project);
      if (!emps.length) return;
      let totalHours = 0, submittedCount = 0;
      const empData = emps.map((emp) => {
        const tsKey = `${emp.id}__${currentPeriod.label}`;
        const ts = allTs[tsKey];
        const hasSubmitted = ts?.status === 'submitted';
        const updatedAt = ts?.updatedAt || null;
        const entries = (ts?.entries || []).filter(
          (e) => e.date >= startStr && e.date <= endStr
        );
        const hours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
        totalHours += hours;
        const filledDates = new Set(entries.map(e => e.date));
        const allCovered = weekdays.length > 0 && weekdays.every(d => filledDates.has(d));
        let status = 'pending';
        if (allCovered && hasSubmitted) { status = 'submitted'; submittedCount++; }
        else if (filledDates.size > 0) status = 'partial';
        return { ...emp, hours, status, entries, updatedAt };
      });
      reports[project] = { employees: empData, totalHours, submittedCount, total: emps.length };
    });
    return projectFilter ? (reports[projectFilter] ? { [projectFilter]: reports[projectFilter] } : {}) : reports;
  }, [allTs, employees, currentPeriod, projectFilter]);

  const handleExportProject = (name, data) => {
    exportProjectExcel(name, data.employees, allTs, currentPeriod.start, currentPeriod.end);
  };

  const handleExportAll = () => {
    exportConsolidatedExcel(projectReports, allTs, currentPeriod.start, currentPeriod.end);
  };

  const handleExportIndividual = (emp) => {
    exportProjectExcel(emp.project || 'Individual', [emp], allTs, currentPeriod.start, currentPeriod.end);
  };

  // Validation checks
  const validation = useMemo(() => {
    if (!currentPeriod) return { issues: [], summary: {} };
    const startStr = format(currentPeriod.start, 'yyyy-MM-dd');
    const endStr = format(currentPeriod.end, 'yyyy-MM-dd');
    const weekdays = getDaysInRange(currentPeriod.start, currentPeriod.end)
      .filter((d) => !isNonWorkingDay(d));
    const expectedWorkdays = weekdays.length;
    const issues = [];

    // Track all employees across projects for duplicate detection
    const empProjectMap = {};

    Object.entries(projectReports).forEach(([project, data]) => {
      data.employees.forEach((emp) => {
        // Track for duplicates
        if (!empProjectMap[emp.id]) empProjectMap[emp.id] = [];
        empProjectMap[emp.id].push({ project, name: emp.name, hours: emp.hours });

        const entries = emp.entries || [];
        const workdayEntries = entries.filter((e) => {
          const d = new Date(e.date + 'T00:00:00');
          return !isNonWorkingDay(d);
        });
        const totalHours = emp.hours;
        const filledDates = new Set(entries.map((e) => e.date));
        const missingWeekdays = weekdays.filter((d) => !filledDates.has(format(d, 'yyyy-MM-dd')));

        // Check 1: Leave days — entries with 0 hours and description containing leave keywords
        const leaveDays = entries.filter((e) => {
          const hrs = parseFloat(e.hours) || 0;
          const desc = (e.description || '').toLowerCase();
          return hrs === 0 && desc && desc !== 'weekend' && !desc.startsWith('weekend');
        });

        if (leaveDays.length > 0) {
          issues.push({
            type: 'info',
            employee: emp.name,
            employeeId: emp.id,
            project,
            message: `${leaveDays.length} leave/off day(s) recorded`,
            detail: leaveDays.map((e) => `${e.date}: "${e.description}"`).join(', '),
          });
        }

        // Check 2: Missing weekdays
        if (missingWeekdays.length > 0) {
          issues.push({
            type: 'error',
            employee: emp.name,
            employeeId: emp.id,
            project,
            message: `${missingWeekdays.length} weekday(s) missing entries`,
            detail: missingWeekdays.map((d) => format(d, 'MMM d (EEE)')).join(', '),
          });
        }

        // Check 3: Hours too low (< 4h avg per workday, excluding leave)
        const workingEntries = workdayEntries.filter((e) => {
          const desc = (e.description || '').toLowerCase();
          return !(parseFloat(e.hours) === 0 && desc && desc !== 'weekend' && !desc.startsWith('weekend'));
        });
        const actualWorkdays = workingEntries.length;
        if (actualWorkdays > 0 && totalHours / actualWorkdays < 4) {
          issues.push({
            type: 'warning',
            employee: emp.name,
            employeeId: emp.id,
            project,
            message: `Low avg hours: ${(totalHours / actualWorkdays).toFixed(1)}h/day (${totalHours}h total over ${actualWorkdays} workdays)`,
            detail: 'Expected at least 4h average per working day',
          });
        }

        // Check 4: Hours abnormally high (> 12h on any single day)
        const highDays = entries.filter((e) => parseFloat(e.hours) > 12);
        if (highDays.length > 0) {
          issues.push({
            type: 'warning',
            employee: emp.name,
            employeeId: emp.id,
            project,
            message: `${highDays.length} day(s) with >12 hours`,
            detail: highDays.map((e) => `${e.date}: ${e.hours}h`).join(', '),
          });
        }

        // Check 5: Not submitted
        if (emp.status !== 'submitted') {
          issues.push({
            type: 'error',
            employee: emp.name,
            employeeId: emp.id,
            project,
            message: `Timesheet not fully submitted (status: ${emp.status})`,
            detail: '',
          });
        }
      });
    });

    // Check 6: Duplicate employees across projects
    Object.entries(empProjectMap).forEach(([empId, projects]) => {
      if (projects.length > 1) {
        issues.push({
          type: 'warning',
          employee: projects[0].name,
          employeeId: empId,
          project: projects.map((p) => p.project).join(', '),
          message: `Appears in ${projects.length} projects`,
          detail: projects.map((p) => `${p.project}: ${p.hours}h`).join(' | '),
        });
      }
    });

    // Sort: errors first, then warnings, then info
    const priority = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => priority[a.type] - priority[b.type]);

    const errorCount = issues.filter((i) => i.type === 'error').length;
    const warningCount = issues.filter((i) => i.type === 'warning').length;
    const infoCount = issues.filter((i) => i.type === 'info').length;

    return { issues, summary: { errorCount, warningCount, infoCount, expectedWorkdays } };
  }, [projectReports, currentPeriod]);

  return (
    <div>
      <PageHeader
        icon={FileBarChart}
        title="Consolidated Reports"
        subtitle="Export timesheet reports across projects"
        actions={
          <button onClick={handleExportAll} className="h-9 px-4 rounded-xl text-[13px] font-medium bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:opacity-90 transition-all flex items-center gap-1.5 shadow-lg shadow-primary-600/25">
            <Download size={14} strokeWidth={2} />Download Excel
          </button>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Month</label>
            <select
              value={month}
              onChange={(e) => { setMonth(+e.target.value); setPeriodIndex(0); }}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
            >
              {[...Array(12)].map((_, m) => (
                <option key={m} value={m}>{format(new Date(year, m, 1), 'MMMM yyyy')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Period</label>
            <select
              value={periodIndex}
              onChange={(e) => setPeriodIndex(+e.target.value)}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
            >
              {periods.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Project</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
            >
              <option value="">All Projects</option>
              {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-px mb-5 bg-white rounded-xl p-1 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all duration-100 ${
              activeTab === t.key ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'date-wise' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[13px] font-semibold text-slate-800">Project Reports</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Project</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">End Date</th>
                <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Hours</th>
                <th className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Export</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(projectReports).map(([project, data], i) => {
                const latest = data.employees.filter((e) => e.updatedAt).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]?.updatedAt;
                return (
                  <motion.tr key={project} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-2.5 text-[13px] font-medium text-slate-800">{project}</td>
                    <td className="px-6 py-2.5 text-[12px] text-slate-500 tabular-nums">{format(currentPeriod.end, 'M/d/yyyy')}</td>
                    <td className="px-6 py-2.5 text-[13px] font-semibold text-slate-800 text-right tabular-nums">{data.totalHours}</td>
                    <td className="px-6 py-2.5 text-center">
                      <button onClick={() => handleExportProject(project, data)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600/10 hover:bg-primary-100 transition-all">
                        <FileSpreadsheet size={12} />Excel
                      </button>
                    </td>
                    <td className="px-6 py-2.5 text-[11px] text-slate-400">
                      {latest ? `${new Date(latest).toLocaleDateString()} ${new Date(latest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--'}
                    </td>
                  </motion.tr>
                );
              })}
              {!Object.keys(projectReports).length && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-[13px] text-slate-400">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'period-wise' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[13px] font-semibold text-slate-800">Period-wise Summary</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Project</th>
                <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Employees</th>
                <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Submitted</th>
                <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Pending</th>
                <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(projectReports).map(([project, data], i) => (
                <motion.tr key={project} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-2.5 text-[13px] font-medium text-slate-800">{project}</td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500 text-right tabular-nums">{data.total}</td>
                  <td className="px-6 py-2.5 text-[12px] text-accent-600 font-medium text-right tabular-nums">{data.submittedCount}</td>
                  <td className="px-6 py-2.5 text-[12px] text-warning-600 font-medium text-right tabular-nums">{data.total - data.submittedCount}</td>
                  <td className="px-6 py-2.5 text-[13px] font-semibold text-slate-800 text-right tabular-nums">{data.totalHours}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'individual' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[13px] font-semibold text-slate-800">Individual Employee Reports</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Employee</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">ID</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Project</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Hours</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Rate ($/hr)</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Total ($)</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3 w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {employees.filter((e) => !projectFilter || e.project === projectFilter).map((emp, i) => {
                  const startStr = currentPeriod ? format(currentPeriod.start, 'yyyy-MM-dd') : '';
                  const endStr = currentPeriod ? format(currentPeriod.end, 'yyyy-MM-dd') : '';
                  const weekdays = currentPeriod ? getDaysInRange(currentPeriod.start, currentPeriod.end)
                    .filter((d) => !isNonWorkingDay(d)).map((d) => format(d, 'yyyy-MM-dd')) : [];
                  const tsKey = `${emp.id}__${currentPeriod.label}`;
                  const tsData = allTs[tsKey];
                  const hasSubmitted = tsData?.status === 'submitted';
                  const empEntries = (tsData?.entries || []).filter(
                    (e) => e.date >= startStr && e.date <= endStr
                  );
                  const hours = empEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
                  const rate = emp.hourly_rate || 0;
                  const total = hours * rate;
                  const filledDates = new Set(empEntries.map(e => e.date));
                  const allCovered = weekdays.length > 0 && weekdays.every(d => filledDates.has(d));
                  const empStatus = allCovered && hasSubmitted ? 'submitted' : filledDates.size > 0 ? 'partial' : 'pending';
                  return (
                    <motion.tr key={emp.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-2.5 text-[13px] font-medium text-slate-800">{emp.name}</td>
                      <td className="px-6 py-2.5 text-[12px] text-slate-500 tabular-nums">{emp.id}</td>
                      <td className="px-6 py-2.5 text-[12px] text-slate-500">{emp.project}</td>
                      <td className="px-6 py-2.5 text-[13px] font-semibold text-slate-800 text-right tabular-nums">{hours}</td>
                      <td className="px-6 py-2.5 text-[13px] text-slate-600 text-right tabular-nums">{rate > 0 ? `$${rate}` : '—'}</td>
                      <td className="px-6 py-2.5 text-[13px] font-semibold text-emerald-700 text-right tabular-nums">{total > 0 ? `$${total.toLocaleString()}` : '—'}</td>
                      <td className="px-6 py-2.5"><StatusBadge status={empStatus} /></td>
                      <td className="px-6 py-2.5 text-center">
                        {empEntries.length > 0 && (
                          <button onClick={() => handleExportIndividual({ ...emp, entries: empEntries })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-primary-600 hover:bg-primary-50 transition-all">
                            <Download size={15} strokeWidth={1.8} />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'validation' && (
        <div className="space-y-5">
          {/* Validation Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
              validation.summary.errorCount > 0 ? 'bg-red-50 border-red-200/60' : 'bg-slate-50 border-slate-200/60'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                validation.summary.errorCount > 0 ? 'bg-red-100' : 'bg-slate-100'
              }`}>
                <XCircle size={20} className={validation.summary.errorCount > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-[22px] font-bold text-slate-900">{validation.summary.errorCount}</p>
                <p className="text-[11px] text-slate-500">Errors</p>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
              validation.summary.warningCount > 0 ? 'bg-amber-50 border-amber-200/60' : 'bg-slate-50 border-slate-200/60'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                validation.summary.warningCount > 0 ? 'bg-amber-100' : 'bg-slate-100'
              }`}>
                <AlertTriangle size={20} className={validation.summary.warningCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-[22px] font-bold text-slate-900">{validation.summary.warningCount}</p>
                <p className="text-[11px] text-slate-500">Warnings</p>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
              validation.summary.errorCount === 0 && validation.summary.warningCount === 0 ? 'bg-emerald-50 border-emerald-200/60' : 'bg-blue-50 border-blue-200/60'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                validation.summary.errorCount === 0 && validation.summary.warningCount === 0 ? 'bg-emerald-100' : 'bg-blue-100'
              }`}>
                {validation.summary.errorCount === 0 && validation.summary.warningCount === 0
                  ? <CheckCircle size={20} className="text-emerald-500" />
                  : <AlertCircle size={20} className="text-blue-500" />
                }
              </div>
              <div>
                <p className="text-[22px] font-bold text-slate-900">{validation.summary.infoCount}</p>
                <p className="text-[11px] text-slate-500">
                  {validation.summary.errorCount === 0 && validation.summary.warningCount === 0 ? 'All Clear' : 'Info Notes'}
                </p>
              </div>
            </div>
          </div>

          {/* Validation Issues List */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-800">Validation Results</h2>
              <span className="text-[11px] text-slate-400">
                {validation.summary.expectedWorkdays} workdays in period
              </span>
            </div>

            {validation.issues.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-slate-700">All validations passed</p>
                <p className="text-[12px] text-slate-400 mt-1">No issues found for this period. Ready to export.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {validation.issues.map((issue, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`px-5 py-3 flex items-start gap-3 ${
                      issue.type === 'error' ? 'bg-red-50/30' : issue.type === 'warning' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <div className="mt-0.5">
                      {issue.type === 'error' && <XCircle size={16} className="text-red-500" />}
                      {issue.type === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
                      {issue.type === 'info' && <AlertCircle size={16} className="text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-800">{issue.employee}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums">{issue.employeeId}</span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{issue.project}</span>
                      </div>
                      <p className={`text-[12px] mt-0.5 ${
                        issue.type === 'error' ? 'text-red-600' : issue.type === 'warning' ? 'text-amber-700' : 'text-blue-600'
                      }`}>{issue.message}</p>
                      {issue.detail && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{issue.detail}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
