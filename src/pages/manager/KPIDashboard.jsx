import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Target, CheckCircle2, Clock, Calendar, Users } from 'lucide-react';
import { useTimesheets } from '../../context/TimesheetContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function KPIDashboard() {
  const { getAllTimesheets, employees: allEmployees } = useTimesheets();
  const now = new Date();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [year] = useState(now.getFullYear());

  const employees = allEmployees.filter(u => u.role === 'employee' && !u.is_archived);
  const allTs = getAllTimesheets();

  // Auto-select first employee
  const activeEmployee = selectedEmployee || (employees.length > 0 ? employees[0].id : '');
  const empInfo = employees.find(e => e.id === activeEmployee);

  // Compute KPI from timesheet data across all months
  const kpi = useMemo(() => {
    if (!activeEmployee) return null;

    const prefix = `${activeEmployee}__`;
    const periods = [];
    let totalHours = 0;
    let submittedCount = 0;
    let totalPeriods = 0;

    // Gather all periods for this employee
    Object.entries(allTs).forEach(([key, val]) => {
      if (key.startsWith(prefix)) {
        const periodLabel = key.replace(prefix, '');
        const hours = val.entries?.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0) || 0;
        const daysWorked = val.entries?.filter(e => parseFloat(e.hours) > 0).length || 0;
        totalHours += hours;
        totalPeriods++;
        if (val.status === 'submitted') submittedCount++;
        periods.push({ label: periodLabel, hours, status: val.status, daysWorked, entries: val.entries || [] });
      }
    });

    // Monthly breakdown for chart — collect entries by date range per month
    const monthlyData = [];
    for (let m = 0; m < 12; m++) {
      const startStr = `${year}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, m + 1, 0).getDate();
      const endStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      let hours = 0, daysWorked = 0, hasSubmitted = false;
      periods.forEach((p) => {
        if (p.status === 'submitted') {
          // Check if any entries fall in this month
          const monthEntries = p.entries.filter(e => e.date >= startStr && e.date <= endStr);
          if (monthEntries.length > 0) hasSubmitted = true;
        }
        p.entries.forEach((e) => {
          if (e.date >= startStr && e.date <= endStr) {
            hours += parseFloat(e.hours) || 0;
            if ((parseFloat(e.hours) || 0) > 0) daysWorked++;
          }
        });
      });
      monthlyData.push({
        month: MONTHS[m],
        hours: Math.round(hours),
        daysWorked,
        status: hasSubmitted ? 'submitted' : hours > 0 ? 'partial' : 'no_data',
      });
    }

    const avgHoursPerPeriod = totalPeriods > 0 ? totalHours / totalPeriods : 0;
    const submissionRate = totalPeriods > 0 ? Math.round((submittedCount / totalPeriods) * 100) : 0;

    // Current month stats
    const cm = now.getMonth();
    const currentMonthData = monthlyData[cm];
    const currentHours = currentMonthData.hours;
    const currentDaysWorked = currentMonthData.daysWorked;

    return {
      totalHours,
      totalPeriods,
      submittedCount,
      submissionRate,
      avgHoursPerPeriod: Math.round(avgHoursPerPeriod),
      currentHours,
      currentDaysWorked,
      currentStatus: currentMonthData.status === 'no_data' ? 'pending' : currentMonthData.status,
      monthlyData,
      periods,
    };
  }, [activeEmployee, allTs, year]);

  const maxMonthlyHours = kpi ? Math.max(...kpi.monthlyData.map(m => m.hours), 1) : 1;

  return (
    <div>
      <PageHeader icon={BarChart3} title="KPI Dashboard" subtitle="Employee performance based on timesheet data" />

      {/* Employee Selector */}
      <Card className="mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Employee</label>
            <select
              value={activeEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
              ))}
            </select>
          </div>
          {empInfo && (
            <div className="flex items-center gap-2 ml-auto">
              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${
                empInfo.location_type === 'onshore'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                  : 'bg-blue-50 text-blue-700 ring-blue-600/10'
              }`}>
                {empInfo.location_type === 'onshore' ? 'Onshore (US)' : 'Offshore (India)'}
              </span>
              <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                {empInfo.project?.replace('VCC - ', '')}
              </span>
            </div>
          )}
        </div>
      </Card>

      {kpi && (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Clock} label="Total Hours (All Time)" value={kpi.totalHours} color="purple" delay={0} />
            <StatCard icon={Target} label="Avg Hours / Month" value={kpi.avgHoursPerPeriod} color="blue" delay={0.05} />
            <StatCard icon={CheckCircle2} label="Submission Rate" value={`${kpi.submissionRate}%`} color="green" delay={0.1} />
            <StatCard icon={Calendar} label="Current Month Hours" value={kpi.currentHours} color="orange" delay={0.15} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Submission Rate Ring */}
            <Card className="p-5">
              <h3 className="text-[13px] font-semibold text-slate-700 mb-4">Submission Rate</h3>
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                    <motion.circle
                      cx="50" cy="50" r="42"
                      stroke={kpi.submissionRate >= 75 ? '#22c55e' : kpi.submissionRate >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8" fill="none" strokeLinecap="round"
                      initial={{ strokeDasharray: '0 264' }}
                      animate={{ strokeDasharray: `${kpi.submissionRate * 2.64} 264` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[24px] font-bold text-slate-900">{kpi.submissionRate}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-[11px] text-slate-400 mt-3">
                {kpi.submittedCount} of {kpi.totalPeriods} periods submitted
              </p>
            </Card>

            {/* Monthly Hours Bar Chart */}
            <div className="lg:col-span-2">
              <Card className="p-5">
                <h3 className="text-[13px] font-semibold text-slate-700 mb-4">Monthly Hours ({year})</h3>
                <div className="flex items-end gap-2 h-40">
                  {kpi.monthlyData.map((m, i) => {
                    const pct = (m.hours / maxMonthlyHours) * 100;
                    const isCurrentMonth = i === now.getMonth();
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-slate-500 tabular-nums">{m.hours || ''}</span>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(pct, m.hours > 0 ? 4 : 0)}%` }}
                          transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }}
                          className={`w-full rounded-t-md ${
                            m.status === 'submitted'
                              ? 'bg-gradient-to-t from-emerald-500 to-emerald-400'
                              : m.hours > 0
                              ? 'bg-gradient-to-t from-primary-500 to-primary-400'
                              : 'bg-slate-100'
                          } ${isCurrentMonth ? 'ring-2 ring-primary-300 ring-offset-1' : ''}`}
                        />
                        <span className={`text-[9px] font-medium ${isCurrentMonth ? 'text-primary-600 font-bold' : 'text-slate-400'}`}>
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-[10px] text-slate-500">Submitted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary-500" />
                    <span className="text-[10px] text-slate-500">Saved / Pending</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Period History Table */}
          <Card className="overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-200/60 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-800">Period History</h2>
              <span className="text-[11px] text-slate-400">{kpi.periods.length} periods</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Period</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Days Worked</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Hours</th>
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Avg Hrs/Day</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {kpi.periods.sort((a, b) => b.label.localeCompare(a.label)).map((p, i) => {
                  const avgPerDay = p.daysWorked > 0 ? (p.hours / p.daysWorked).toFixed(1) : '0';
                  return (
                    <motion.tr
                      key={p.label}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 py-2.5 text-[13px] font-medium text-slate-800">{p.label}</td>
                      <td className="px-6 py-2.5 text-[12px] text-slate-500 text-right tabular-nums">{p.daysWorked}</td>
                      <td className="px-6 py-2.5 text-[13px] font-semibold text-slate-800 text-right tabular-nums">{p.hours}h</td>
                      <td className="px-6 py-2.5 text-[12px] text-slate-500 text-right tabular-nums">{avgPerDay}h</td>
                      <td className="px-6 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${
                          p.status === 'submitted'
                            ? 'bg-accent-50 text-accent-700 ring-accent-600/10'
                            : 'bg-warning-50 text-warning-700 ring-warning-600/10'
                        }`}>
                          {p.status === 'submitted' ? 'Submitted' : 'Pending'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
                {kpi.periods.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[13px] text-slate-400">No timesheet data found for this employee.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
