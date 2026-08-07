import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, CheckCircle, AlertTriangle, X, ChevronDown, ChevronUp, Eye, LayoutDashboard, Globe, Building2, Briefcase, FileSignature, ScrollText } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { useTimesheets } from '../../context/TimesheetContext';
import { useAuth } from '../../context/AuthContext';
import { getFortnightlyPeriods, getDaysInRange, isNonWorkingDay } from '../../data/mockData';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import SortableHeader, { sortData } from '../../components/SortableHeader';

function getEmployeeType(emp) {
  if (emp.designation === 'Consultant') return 'consultant';
  if (emp.location_type === 'onshore') return 'onshore';
  if (emp.location_type) return emp.location_type;
  return 'offshore';
}

function getEmployeeTypeLabel(type) {
  if (type === 'onshore') return 'Onsite (US)';
  if (type === 'offshore') return 'Offshore (India)';
  if (type === 'consultant') return 'Consultant';
  return 'Unknown';
}

function EmployeeDetailModal({ employee, allTs, onClose }) {
  const [expandedPeriod, setExpandedPeriod] = useState(null);

  const history = useMemo(() => {
    const prefix = `${employee.id}__`;
    const periods = [];
    Object.entries(allTs).forEach(([key, val]) => {
      if (key.startsWith(prefix)) {
        const periodLabel = key.replace(prefix, '');
        const totalHours = val.entries?.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0) || 0;
        periods.push({ label: periodLabel, status: val.status, totalHours, entries: val.entries || [], updatedAt: val.updatedAt });
      }
    });
    periods.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return periods;
  }, [employee.id, allTs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[6px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-auto shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] border border-slate-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-[12px] font-bold">
                {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">{employee.name}</h3>
              <p className="text-[11px] text-slate-400">{employee.id} &middot; {employee.project}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {history.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[13px] text-slate-400">No timesheet data found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((period) => {
                const isExpanded = expandedPeriod === period.label;
                return (
                  <div key={period.label} className="border border-slate-200/60 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedPeriod(isExpanded ? null : period.label)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/50 hover:bg-slate-100/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold text-slate-800">{period.label}</span>
                        <StatusBadge status={period.status} size="sm" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-bold text-slate-700 tabular-nums">{period.totalHours}h</span>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <table className="w-full">
                            <thead>
                              <tr className="bg-slate-800">
                                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider">Date</th>
                                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider">Day</th>
                                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider">Work Item</th>
                                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider">Description</th>
                                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider">Hours</th>
                              </tr>
                            </thead>
                            <tbody>
                              {period.entries.map((e) => {
                                const isWknd = e.dayName && ['Saturday', 'Sunday'].includes(e.dayName);
                                return (
                                  <tr key={e.date} className={`border-b border-slate-50 ${isWknd ? 'bg-slate-50/50' : ''}`}>
                                    <td className="px-5 py-2.5 text-[12px] text-slate-700 tabular-nums">{e.date}</td>
                                    <td className="px-5 py-2.5 text-[12px] text-slate-400">{e.dayName?.slice(0, 3) || '--'}</td>
                                    <td className="px-5 py-2.5 text-[12px] text-slate-500">{e.workItem || '--'}</td>
                                    <td className="px-5 py-2.5 text-[12px] text-slate-500">{e.description || '--'}</td>
                                    <td className="px-5 py-2.5 text-[12px] font-semibold text-slate-800 text-right tabular-nums">{e.hours}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="px-5 py-3 bg-slate-50 text-right border-t border-slate-100">
                            <span className="text-[12px] text-slate-400">Total: </span>
                            <span className="text-[14px] font-bold text-slate-900 tabular-nums">{period.totalHours}h</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { getAllTimesheets, employees: allEmployees } = useTimesheets();
  const now = new Date();
  const fortnightlyPeriods = getFortnightlyPeriods(now.getFullYear(), now.getMonth());
  // Find the period containing today
  const todayStr = format(now, 'yyyy-MM-dd');
  const currentPeriod = fortnightlyPeriods.find(p =>
    format(p.start, 'yyyy-MM-dd') <= todayStr && format(p.end, 'yyyy-MM-dd') >= todayStr
  ) || fortnightlyPeriods[0];
  const employees = allEmployees.filter((u) => u.role === 'employee' && !u.is_archived && u.project === user?.project);
  const allTs = getAllTimesheets();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  // Weekdays in the fortnightly period
  const periodWeekdays = useMemo(() => {
    if (!currentPeriod) return [];
    return getDaysInRange(currentPeriod.start, currentPeriod.end)
      .filter((d) => !isNonWorkingDay(d))
      .map((d) => format(d, 'yyyy-MM-dd'));
  }, [currentPeriod]);

  // Get entries within fortnightly date range for an employee
  const getEmpPeriodData = useMemo(() => {
    const startStr = format(currentPeriod.start, 'yyyy-MM-dd');
    const endStr = format(currentPeriod.end, 'yyyy-MM-dd');
    return (emp) => {
      let entries = [];
      let hasSubmitted = false;
      Object.entries(allTs).forEach(([key, ts]) => {
        if (!key.startsWith(`${emp.id}__`)) return;
        if (ts.status === 'submitted') hasSubmitted = true;
        (ts.entries || []).forEach((e) => {
          if (e.date >= startStr && e.date <= endStr) entries.push(e);
        });
      });
      const hours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
      const filledDates = new Set(entries.map(e => e.date));
      const allCovered = periodWeekdays.length > 0 && periodWeekdays.every(d => filledDates.has(d));
      let status = 'pending';
      if (allCovered && hasSubmitted) status = 'submitted';
      else if (filledDates.size > 0) status = 'partial';
      return { entries, hours, status };
    };
  }, [allTs, currentPeriod, periodWeekdays]);

  const stats = useMemo(() => {
    let submitted = 0, saved = 0, pending = 0, totalHours = 0;
    employees.forEach((emp) => {
      const data = getEmpPeriodData(emp);
      if (data.status === 'submitted') { submitted++; }
      else if (data.status === 'saved') { saved++; }
      else { pending++; }
      totalHours += data.hours;
    });
    return { submitted, saved, pending, totalHours, total: employees.length };
  }, [employees, getEmpPeriodData]);

  const workforce = useMemo(() => {
    const breakdown = { onshore: [], offshore: [], consultant: [] };
    employees.forEach((emp) => {
      const type = getEmployeeType(emp);
      if (breakdown[type]) breakdown[type].push(emp);
    });
    return breakdown;
  }, [employees]);

  // SOW signing reminders — pending DocuSign + draft SOWs.
  const [pendingSows, setPendingSows] = useState([]);
  useEffect(() => {
    api.get('/sows')
      .then(d => setPendingSows((d.sows || []).filter(s => s.status === 'sent_for_signature' || s.status === 'finance_approved')))
      .catch(() => setPendingSows([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Team Dashboard"
        subtitle={`${user?.project?.replace('VCC - ', '') || 'My Team'} — ${currentPeriod.label}`}
        icon={LayoutDashboard}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard icon={Users} label="Total Employees" value={stats.total} color="blue" delay={0} />
        <StatCard icon={CheckCircle} label="Submitted" value={stats.submitted} color="green" delay={0.06} />
        <StatCard icon={AlertTriangle} label="Pending" value={stats.pending} color="orange" delay={0.12} />
        <StatCard icon={Clock} label="Hours Logged" value={stats.totalHours} color="purple" delay={0.18} />
      </div>

      {/* SOW Signing Reminders */}
      {pendingSows.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mb-7 bg-gradient-to-br from-violet-50/70 via-white to-amber-50/50 border border-violet-200/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                <FileSignature size={16} className="text-white" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-violet-900">SOWs awaiting signature</h3>
                <p className="text-[11px] text-violet-700/70">Reminders for SOWs waiting on DocuSign — signed via email, but track them here so onboarding isn't blocked.</p>
              </div>
            </div>
            <Link to="/admin/sow-workflow" className="text-[11px] font-semibold text-violet-700 hover:text-violet-900">Open SOW Manager →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingSows.slice(0, 6).map(s => {
              const sentAt = s.updated_at ? parseISO(s.updated_at) : null;
              const daysWaiting = sentAt ? differenceInDays(new Date(), sentAt) : null;
              const overdue = daysWaiting != null && daysWaiting >= 7;
              return (
                <Link key={s.id} to="/admin/sow-workflow" className="flex items-center justify-between p-3 rounded-xl bg-white border border-violet-100 hover:border-violet-300 hover:shadow-sm transition-all">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-slate-500">{s.sow_number}</p>
                    <p className="text-[12px] font-semibold text-slate-800 truncate" title={s.title}>{s.title}</p>
                    {s.vendor_name && <p className="text-[10px] text-slate-400 mt-0.5">{s.vendor_name}</p>}
                  </div>
                  <div className="ml-2 text-right flex-shrink-0">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                      s.status === 'sent_for_signature' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {s.status === 'sent_for_signature' ? 'Awaiting sign' : 'Ready to send'}
                    </span>
                    {daysWaiting != null && (
                      <p className={`text-[10px] mt-0.5 tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                        {overdue ? `${daysWaiting}d overdue` : `${daysWaiting}d ago`}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Workforce Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        {[
          { key: 'offshore', icon: Globe, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/10' },
          { key: 'onshore', icon: Building2, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/10' },
          { key: 'consultant', icon: Briefcase, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-600/10' },
        ].map(({ key, icon: Icon, color, bg, text, ring }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + idx * 0.06 }}
            className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                  <Icon size={18} strokeWidth={1.8} className="text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{getEmployeeTypeLabel(key)}</p>
                  <p className="text-[11px] text-slate-400">{workforce[key].length} employees</p>
                </div>
              </div>
              <span className="text-[24px] font-bold text-slate-900 tabular-nums">{workforce[key].length}</span>
            </div>
            {workforce[key].length > 0 && (
              <div className="px-5 pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {workforce[key].slice(0, 8).map((emp) => (
                    <span key={emp.id} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${bg} ${text} ring-1 ring-inset ${ring}`}>
                      {emp.name.split(' ')[0]}
                    </span>
                  ))}
                  {workforce[key].length > 8 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
                      +{workforce[key].length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Employee Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-slate-800">Employee Status</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Click on an employee to view their timesheet history</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <SortableHeader label="Employee" sortKey="name" currentSort={sort} onSort={setSort} />
                <SortableHeader label="ID" sortKey="id" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Project" sortKey="project" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Type" sortKey="_type" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Hours" sortKey="_hours" currentSort={sort} onSort={setSort} align="right" />
                <SortableHeader label="Status" sortKey="_status" currentSort={sort} onSort={setSort} />
                <th className="px-6 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sortData(
                employees.map(emp => {
                  const data = getEmpPeriodData(emp);
                  return {
                    ...emp,
                    _hours: data.hours,
                    _status: data.status,
                    _type: getEmployeeType(emp),
                  };
                }),
                sort
              ).map((emp, i) => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                    onClick={() => setSelectedEmployee(emp)}
                    className="border-b border-slate-50 hover:bg-primary-50/30 transition-all duration-200 cursor-pointer group"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center group-hover:from-primary-100 group-hover:to-primary-50 group-hover:border-primary-200 transition-all">
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-primary-600 transition-colors">
                            {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-[13px] font-medium text-slate-800">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[12px] text-slate-400 tabular-nums font-mono">{emp.id}</td>
                    <td className="px-6 py-3.5">
                      <span className="text-[12px] text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        {emp.project?.replace('VCC - ', '')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {(() => {
                        const styles = emp._type === 'onshore'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                          : emp._type === 'consultant'
                          ? 'bg-violet-50 text-violet-700 ring-violet-600/10'
                          : 'bg-blue-50 text-blue-700 ring-blue-600/10';
                        return (
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${styles}`}>
                            {emp._type === 'onshore' ? 'US' : emp._type === 'consultant' ? 'CON' : 'IN'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-3.5 text-[13px] font-bold text-slate-800 text-right tabular-nums">{emp._hours}h</td>
                    <td className="px-6 py-3.5"><StatusBadge status={emp._status} size="sm" /></td>
                    <td className="px-6 py-3.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 group-hover:text-primary-500 group-hover:bg-primary-50 transition-all">
                        <Eye size={16} strokeWidth={1.8} />
                      </div>
                    </td>
                  </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {selectedEmployee && (
          <EmployeeDetailModal employee={selectedEmployee} allTs={allTs} onClose={() => setSelectedEmployee(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
