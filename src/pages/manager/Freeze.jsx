import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Lock, Snowflake, X, Pencil } from 'lucide-react';
import { useTimesheets } from '../../context/TimesheetContext';
import { useAuth } from '../../context/AuthContext';
import { getFortnightlyPeriods, getDaysInRange, isNonWorkingDay, isWeekend } from '../../data/mockData';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import SortableHeader, { sortData } from '../../components/SortableHeader';

export default function Freeze() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getAllTimesheets, freezePeriod, isPeriodFrozen, employees: allEmployees } = useTimesheets();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [periodIndex, setPeriodIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  const periods = getFortnightlyPeriods(year, month);
  const currentPeriod = periods[periodIndex] || periods[0];
  const allTs = getAllTimesheets();
  const frozen = isPeriodFrozen(currentPeriod.label, user?.project || undefined);

  const employees = allEmployees.filter(
    (u) => u.role === 'employee' && !u.is_archived && u.is_active !== false && u.project === user?.project
  );

  // All days in the fortnightly period (for modal calendar)
  const periodDays = useMemo(() => {
    if (!currentPeriod) return [];
    return getDaysInRange(currentPeriod.start, currentPeriod.end);
  }, [currentPeriod]);

  // Get all weekdays in the fortnightly period
  const periodWeekdays = useMemo(() => {
    return periodDays.filter((d) => !isNonWorkingDay(d)).map((d) => format(d, 'yyyy-MM-dd'));
  }, [periodDays]);

  // Check actual date-level coverage for each employee
  const submissionStatus = useMemo(() => {
    let submitted = 0, pending = 0;
    const pendingList = [];
    const empDetails = {};

    employees.forEach((emp) => {
      const filledDates = new Set();
      const entriesByDate = {};
      let hasSubmitted = false;

      Object.entries(allTs).forEach(([key, ts]) => {
        if (!key.startsWith(`${emp.id}__`)) return;
        if (ts.status === 'submitted') hasSubmitted = true;
        (ts.entries || []).forEach((e) => {
          filledDates.add(e.date);
          entriesByDate[e.date] = e;
        });
      });

      const coveredDays = periodWeekdays.filter((d) => filledDates.has(d));
      const missingDays = periodWeekdays.filter((d) => !filledDates.has(d));
      const allCovered = missingDays.length === 0 && periodWeekdays.length > 0;
      const isComplete = allCovered && hasSubmitted;

      empDetails[emp.id] = {
        covered: coveredDays.length,
        total: periodWeekdays.length,
        missingDays,
        isComplete,
        hasSubmitted,
        entriesByDate,
      };

      if (isComplete) {
        submitted++;
      } else {
        pending++;
        pendingList.push(emp);
      }
    });

    return { submitted, pending, pendingList, empDetails, allSubmitted: pending === 0 && employees.length > 0 };
  }, [employees, currentPeriod, allTs, periodWeekdays]);

  const pct = employees.length ? Math.round((submissionStatus.submitted / employees.length) * 100) : 0;

  // Selected employee detail for modal
  const selectedDetail = selectedEmployee ? submissionStatus.empDetails[selectedEmployee.id] : null;

  return (
    <div>
      <PageHeader icon={Snowflake} title="Freeze Period" subtitle="Lock timesheets after all submissions" />

      <Card className="mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Month</label>
            <select
              value={month}
              onChange={(e) => { setMonth(+e.target.value); setPeriodIndex(0); }}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            >
              {[...Array(12)].map((_, m) => (
                <option key={m} value={m}>{format(new Date(year, m, 1), 'MMMM yyyy')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Period</label>
            <select
              value={periodIndex}
              onChange={(e) => setPeriodIndex(+e.target.value)}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            >
              {periods.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Project</label>
            <span className="h-8 px-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-[12px] text-slate-700 flex items-center font-medium">{user?.project || 'N/A'}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Employee list */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-200/60 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-800">Submission Status</h2>
              <span className="text-[11px] text-slate-400 tabular-nums">{submissionStatus.submitted}/{employees.length} complete</span>
            </div>
            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full rounded-full ${pct === 100 ? 'bg-accent-500' : 'bg-primary-500'}`}
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <SortableHeader label="Employee" sortKey="name" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Project" sortKey="project" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Coverage" sortKey="_coverage" currentSort={sort} onSort={setSort} align="right" />
                  <SortableHeader label="Status" sortKey="_status" currentSort={sort} onSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {sortData(
                  employees.map(emp => {
                    const detail = submissionStatus.empDetails[emp.id] || {};
                    return {
                      ...emp,
                      _coverage: detail.total ? detail.covered / detail.total : 0,
                      _status: detail.isComplete ? 'submitted' : detail.covered > 0 ? 'partial' : 'pending',
                      _detail: detail,
                    };
                  }),
                  sort
                ).map((emp, i) => {
                  const detail = emp._detail || {};
                  const coveragePct = detail.total ? Math.round((detail.covered / detail.total) * 100) : 0;
                  return (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedEmployee(emp)}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[11px] font-semibold group-hover:from-primary-600 group-hover:to-primary-700 transition-all">
                            {emp.name.charAt(0)}
                          </div>
                          <span className="text-[13px] text-slate-800 group-hover:text-primary-700 transition-colors">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-2 text-[12px] text-slate-500">{emp.project}</td>
                      <td className="px-6 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                coveragePct === 100 ? 'bg-accent-500' : coveragePct > 0 ? 'bg-warning-400' : 'bg-slate-200'
                              }`}
                              style={{ width: `${coveragePct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-slate-500 tabular-nums w-14 text-right">
                            {detail.covered}/{detail.total} days
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-2">
                        <StatusBadge status={emp._status} size="sm" />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Freeze panel */}
        <div>
          <Card className="p-5 sticky top-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/20">
                <Lock size={18} strokeWidth={1.8} className="text-white" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">Freeze Period</h3>
                <p className="text-[11px] text-slate-500">Lock all timesheets</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-5 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-500">Period</span><span className="font-medium text-slate-800 text-right text-[12px]">{currentPeriod.label}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Weekdays</span><span className="font-medium text-slate-800 tabular-nums">{periodWeekdays.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Employees</span><span className="font-medium text-slate-800 tabular-nums">{employees.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Complete</span><span className="font-medium text-accent-600 tabular-nums">{submissionStatus.submitted}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pending</span><span className="font-medium text-warning-600 tabular-nums">{submissionStatus.pending}</span></div>
            </div>

            {frozen ? (
              <div className="px-3.5 py-2.5 bg-primary-50 border border-primary-200/60 rounded-xl text-[12px] text-primary-700 font-medium text-center">
                Period is frozen
              </div>
            ) : !submissionStatus.allSubmitted ? (
              <div>
                <div className="px-3.5 py-2.5 bg-warning-50 border border-warning-200/60 rounded-xl text-[11px] text-warning-700 mb-4 leading-relaxed">
                  Cannot freeze until all employees have submitted with full date coverage.
                  {submissionStatus.pendingList.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {submissionStatus.pendingList.slice(0, 5).map((e) => {
                        const d = submissionStatus.empDetails[e.id];
                        return (
                          <li key={e.id} className="text-warning-600">
                            -- {e.name} ({d?.covered || 0}/{d?.total || 0} days)
                          </li>
                        );
                      })}
                      {submissionStatus.pendingList.length > 5 && (
                        <li className="text-warning-600">...and {submissionStatus.pendingList.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>
                <button disabled className="w-full h-9 rounded-xl text-[13px] font-medium bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center gap-1.5">
                  <Lock size={14} />Freeze Period
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full h-9 rounded-xl text-[13px] font-medium bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary-600/25"
              >
                <Lock size={14} />Freeze Period
              </button>
            )}
          </Card>
        </div>
      </div>

      {/* Employee Detail Modal */}
      <AnimatePresence>
        {selectedEmployee && selectedDetail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedEmployee(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-auto shadow-xl border border-slate-200/60"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[13px] font-semibold">
                    {selectedEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900">{selectedEmployee.name}</h3>
                    <p className="text-[11px] text-slate-400">{selectedEmployee.project} &middot; {selectedEmployee.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={selectedDetail.isComplete ? 'submitted' : selectedDetail.covered > 0 ? 'partial' : 'pending'} />
                  <button
                    onClick={() => {
                      setSelectedEmployee(null);
                      navigate('/manager/submissions', { state: { editEmployeeId: selectedEmployee.id, month, periodIndex } });
                    }}
                    className="h-8 px-3 rounded-xl text-[12px] font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors flex items-center gap-1.5"
                    title="Edit timesheet"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={() => setSelectedEmployee(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Summary bar */}
              <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-6">
                <div className="text-[12px]">
                  <span className="text-slate-400">Coverage: </span>
                  <span className="font-semibold text-slate-700">{selectedDetail.covered}/{selectedDetail.total} weekdays</span>
                </div>
                <div className="text-[12px]">
                  <span className="text-slate-400">Period: </span>
                  <span className="font-semibold text-slate-700">{currentPeriod.label}</span>
                </div>
                {selectedDetail.missingDays.length > 0 && (
                  <div className="text-[12px]">
                    <span className="text-warning-600 font-medium">{selectedDetail.missingDays.length} missing</span>
                  </div>
                )}
              </div>

              {/* Calendar table */}
              <div className="px-4 py-3">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 w-28">Date</th>
                      <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 w-14">Day</th>
                      <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">Work Item</th>
                      <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">Description</th>
                      <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 w-16">Hours</th>
                      <th className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayName = format(day, 'EEE');
                      const isWknd = isWeekend(day);
                      const isOff = isNonWorkingDay(day);
                      const entry = selectedDetail.entriesByDate[dateStr];
                      const hours = parseFloat(entry?.hours) || 0;
                      const isFilled = !!entry;
                      const isMissing = !isOff && !isFilled;

                      return (
                        <tr
                          key={dateStr}
                          className={`border-b border-slate-50 transition-colors ${
                            isOff
                              ? 'bg-slate-50/60'
                              : isMissing
                              ? 'bg-red-50/40'
                              : isFilled
                              ? 'bg-accent-50/20'
                              : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <span className={`text-[12px] font-medium tabular-nums ${isWknd ? 'text-slate-300' : 'text-slate-700'}`}>
                              {format(day, 'MMM d, yyyy')}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[12px] font-semibold ${isWknd ? 'text-slate-300' : 'text-slate-500'}`}>
                              {dayName}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[12px] ${isWknd ? 'text-slate-300' : 'text-slate-600'}`}>
                              {isWknd ? '--' : (entry?.workItem || entry?.work_item || '--')}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[12px] ${isWknd ? 'text-slate-300' : 'text-slate-600'}`}>
                              {isWknd ? '--' : (entry?.description || '--')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`text-[12px] font-semibold tabular-nums ${
                              isWknd ? 'text-slate-300' : isFilled ? 'text-slate-800' : 'text-red-400'
                            }`}>
                              {isWknd ? '--' : hours || '0'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isWknd ? (
                              <span className="text-[10px] text-slate-300">WE</span>
                            ) : isFilled ? (
                              <span className="inline-flex w-5 h-5 rounded-full bg-accent-100 items-center justify-center">
                                <span className="w-2 h-2 rounded-full bg-accent-500" />
                              </span>
                            ) : (
                              <span className="inline-flex w-5 h-5 rounded-full bg-red-100 items-center justify-center">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Total row */}
                <div className="flex items-center justify-between px-3 py-3 mt-1 bg-slate-50 rounded-xl">
                  <span className="text-[12px] font-medium text-slate-500">Total Hours</span>
                  <span className="text-[16px] font-bold text-slate-900 tabular-nums">
                    {periodDays.reduce((sum, day) => {
                      const entry = selectedDetail.entriesByDate[format(day, 'yyyy-MM-dd')];
                      return sum + (parseFloat(entry?.hours) || 0);
                    }, 0)}h
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Freeze Confirm Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-200/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[16px] font-semibold text-slate-900 mb-1.5">Confirm freeze</h3>
              <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
                This will lock all timesheets for <strong className="text-slate-700">{currentPeriod.label}</strong>. This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConfirm(false)} className="h-9 px-4 rounded-xl text-[13px] font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={() => { freezePeriod(currentPeriod.label, user?.project || undefined); setShowConfirm(false); }} className="h-9 px-4 rounded-xl text-[13px] font-medium bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-600/25">Freeze</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
