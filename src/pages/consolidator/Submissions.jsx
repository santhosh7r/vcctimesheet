import { useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, isBefore, isAfter, isSameDay } from 'date-fns';
import { Eye, X, FileText, ClipboardCheck, Clock, Send, ChevronLeft, ChevronRight, Save, Pencil } from 'lucide-react';
import { useTimesheets } from '../../context/TimesheetContext';
import { useAuth } from '../../context/AuthContext';
import { getFortnightlyPeriods, getDaysInRange, isNonWorkingDay, isWeekend } from '../../data/mockData';
import { supabase, useSupabase } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';
import SortableHeader, { sortData } from '../../components/SortableHeader';

function getWeeksInPeriod(start, end) {
  const weeks = [];
  let weekStart = startOfWeek(start, { weekStartsOn: 1 });
  while (isBefore(weekStart, end) || isSameDay(weekStart, end)) {
    let weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    weeks.push({ start: weekStart, end: weekEnd });
    weekStart = addWeeks(weekStart, 1);
    if (isAfter(weekStart, end)) break;
  }
  return weeks;
}

function getDaysOfWeek(weekStart, weekEnd) {
  const days = [];
  let d = new Date(weekStart);
  while (isBefore(d, weekEnd) || isSameDay(d, weekEnd)) {
    days.push(new Date(d));
    d = new Date(d.getTime() + 86400000);
  }
  return days;
}

export default function AdminSubmissions() {
  const { user } = useAuth();
  const location = useLocation();
  const { getAllTimesheets, employees: allEmployees, projects: PROJECTS, saveTimesheet } = useTimesheets();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(location.state?.month ?? now.getMonth());
  const [periodIndex, setPeriodIndex] = useState(location.state?.periodIndex ?? 0);
  const [projectFilter, setProjectFilter] = useState(location.state?.project || '');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editEntries, setEditEntries] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  const periods = getFortnightlyPeriods(year, month);
  const currentPeriod = periods[periodIndex] || periods[0];
  const employees = allEmployees.filter(
    (u) => u.role === 'employee' && !u.is_archived && (!projectFilter || u.project === projectFilter)
  );
  const allTs = getAllTimesheets();

  const weeks = useMemo(() => {
    if (!currentPeriod) return [];
    return getWeeksInPeriod(currentPeriod.start, currentPeriod.end);
  }, [currentPeriod]);

  const periodWeekdays = useMemo(() => {
    if (!currentPeriod) return [];
    return getDaysInRange(currentPeriod.start, currentPeriod.end)
      .filter((d) => !isNonWorkingDay(d))
      .map((d) => format(d, 'yyyy-MM-dd'));
  }, [currentPeriod]);

  const getEmpPeriodData = useCallback((emp) => {
    if (!currentPeriod) return { entries: [], totalHours: 0, status: 'pending', timesheetId: null };
    const startStr = format(currentPeriod.start, 'yyyy-MM-dd');
    const endStr = format(currentPeriod.end, 'yyyy-MM-dd');
    const tsKey = `${emp.id}__${currentPeriod.label}`;
    const ts = allTs[tsKey];
    const hasSubmitted = ts?.status === 'submitted';
    const timesheetId = ts?.id || null;
    const allEntries = (ts?.entries || []).filter(
      (e) => e.date >= startStr && e.date <= endStr
    );

    const filledDates = new Set(allEntries.map(e => e.date));
    const allWeekdaysCovered = periodWeekdays.length > 0 && periodWeekdays.every(d => filledDates.has(d));

    let status = 'pending';
    if (allWeekdaysCovered && hasSubmitted) status = 'submitted';
    else if (filledDates.size > 0) status = 'partial';

    const totalHours = allEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    return { entries: allEntries, totalHours, status, timesheetId };
  }, [allTs, currentPeriod, periodWeekdays]);

  const filtered = useMemo(() => {
    return employees
      .map((emp) => {
        const data = getEmpPeriodData(emp);
        return { ...emp, ...data };
      })
      .filter((emp) => {
        if (tab === 'submitted') return emp.status === 'submitted';
        if (tab === 'pending') return emp.status !== 'submitted';
        return true;
      });
  }, [employees, currentPeriod, allTs, tab, getEmpPeriodData]);

  const allMapped = useMemo(() => {
    return employees.map((emp) => getEmpPeriodData(emp));
  }, [employees, currentPeriod, allTs, getEmpPeriodData]);

  const totalSubmitted = allMapped.filter((e) => e.status === 'submitted').length;
  const totalPending = allMapped.filter((e) => e.status !== 'submitted').length;
  const totalHours = allMapped.reduce((s, e) => s + e.totalHours, 0);

  const openEditor = useCallback((emp) => {
    setEditingEmployee(emp);
    setEditEntries(JSON.parse(JSON.stringify(emp.entries || [])));
    setWeekIndex(0);
  }, []);

  // Auto-open editor when navigating from Freeze page
  const [autoEditDone, setAutoEditDone] = useState(false);
  useEffect(() => {
    const editId = location.state?.editEmployeeId;
    if (editId && filtered.length > 0 && !autoEditDone) {
      const emp = filtered.find(e => e.id === editId);
      if (emp) {
        openEditor(emp);
        setAutoEditDone(true);
        window.history.replaceState({}, '');
      }
    }
  }, [location.state?.editEmployeeId, filtered, autoEditDone, openEditor]);

  const currentWeek = weeks[weekIndex];
  const weekDays = useMemo(() => {
    if (!currentWeek) return [];
    return getDaysOfWeek(currentWeek.start, currentWeek.end);
  }, [currentWeek]);

  const getEntryForDate = useCallback((dateStr) => {
    return editEntries.find(e => e.date === dateStr);
  }, [editEntries]);

  const updateEntry = useCallback((dateStr, dayName, field, value) => {
    setEditEntries(prev => {
      const idx = prev.findIndex(e => e.date === dateStr);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [field]: field === 'hours' ? (parseFloat(value) || 0) : value };
        return updated;
      }
      return [...prev, {
        date: dateStr,
        dayName,
        workItem: '',
        description: '',
        hours: 0,
        [field]: field === 'hours' ? (parseFloat(value) || 0) : value,
      }];
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      const nonEmpty = editEntries.filter(e => e.hours || e.workItem || e.description);

      if (useSupabase && supabase && editingEmployee.timesheetId) {
        await supabase
          .from('timesheet_entries')
          .delete()
          .eq('timesheet_id', editingEmployee.timesheetId);

        if (nonEmpty.length > 0) {
          const rows = nonEmpty.map(e => ({
            timesheet_id: editingEmployee.timesheetId,
            date: e.date,
            day_name: e.dayName || e.day_name || '',
            work_item: e.workItem || e.work_item || '',
            description: e.description || '',
            hours: parseFloat(e.hours) || 0,
          }));
          await supabase.from('timesheet_entries').insert(rows);
        }

        const totalHours = nonEmpty.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
        await supabase
          .from('timesheets')
          .update({ total_hours: totalHours, updated_at: new Date().toISOString() })
          .eq('id', editingEmployee.timesheetId);
      }

      saveTimesheet(editingEmployee.id, currentPeriod.label, nonEmpty, editingEmployee.status);
      setEditingEmployee(null);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [editingEmployee, editEntries, currentPeriod, saveTimesheet]);

  const weekTotalHours = useMemo(() => {
    return weekDays.reduce((sum, d) => {
      const entry = getEntryForDate(format(d, 'yyyy-MM-dd'));
      return sum + (parseFloat(entry?.hours) || 0);
    }, 0);
  }, [weekDays, getEntryForDate]);

  const editTotalHours = useMemo(() => {
    return editEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  }, [editEntries]);

  return (
    <div>
      <PageHeader icon={FileText} title="All Submissions" subtitle="Review and edit timesheets across all projects" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Send} label="Submitted" value={totalSubmitted} color="green" delay={0} />
        <StatCard icon={Clock} label="Pending" value={totalPending} color="orange" delay={0.05} />
        <StatCard icon={ClipboardCheck} label="Total Hours" value={totalHours} color="blue" delay={0.1} />
      </div>

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
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            >
              <option value="">All Projects</option>
              {PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <div className="flex gap-px mb-4 bg-white rounded-xl p-1 border border-slate-200/60 w-fit shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {['all', 'submitted', 'pending'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
              tab === t ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <SortableHeader label="Employee" sortKey="name" currentSort={sort} onSort={setSort} />
              <SortableHeader label="ID" sortKey="id" currentSort={sort} onSort={setSort} />
              <SortableHeader label="Project" sortKey="project" currentSort={sort} onSort={setSort} />
              <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Period</th>
              <SortableHeader label="Hours" sortKey="totalHours" currentSort={sort} onSort={setSort} align="right" />
              <SortableHeader label="Status" sortKey="status" currentSort={sort} onSort={setSort} />
              <th className="px-6 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-[13px] text-slate-400">No records found.</td></tr>
            ) : (
              sortData(filtered, sort).map((emp, i) => (
                <motion.tr
                  key={emp.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => openEditor(emp)}
                >
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[11px] font-semibold">
                        {emp.name.charAt(0)}
                      </div>
                      <span className="text-[13px] font-medium text-slate-800">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500 tabular-nums">{emp.id}</td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500">{emp.project}</td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500">
                    {currentPeriod && format(currentPeriod.start, 'M/d')} - {currentPeriod && format(currentPeriod.end, 'M/d/yyyy')}
                  </td>
                  <td className="px-6 py-2.5 text-[13px] font-semibold text-slate-800 text-right tabular-nums">{emp.totalHours}h</td>
                  <td className="px-6 py-2.5"><StatusBadge status={emp.status} /></td>
                  <td className="px-6 py-2.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditor(emp); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                    >
                      <Pencil size={14} strokeWidth={1.8} />
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Edit Modal */}
      {editingEmployee && currentWeek && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
          onClick={() => setEditingEmployee(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-auto shadow-xl border border-slate-200/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[13px] font-semibold">
                  {editingEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{editingEmployee.name}</h3>
                  <p className="text-[11px] text-slate-400">{editingEmployee.project} &middot; {editingEmployee.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            <div className="flex items-center justify-between px-6 py-3 bg-slate-50/80 border-b border-slate-100">
              <button
                onClick={() => setWeekIndex(Math.max(0, weekIndex - 1))}
                disabled={weekIndex === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-slate-800">
                  {format(currentWeek.start, 'MMM d')} — {format(currentWeek.end, 'MMM d, yyyy')}
                </p>
                <p className="text-[11px] text-slate-400">
                  Week {weekIndex + 1} of {weeks.length} &middot; {weekTotalHours}h this week &middot; {editTotalHours}h total
                </p>
              </div>
              <button
                onClick={() => setWeekIndex(Math.min(weeks.length - 1, weekIndex + 1))}
                disabled={weekIndex >= weeks.length - 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="px-4 py-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-2 w-24">Day</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-2">Work Item</th>
                    <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-2">Description</th>
                    <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-2 w-20">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayName = format(day, 'EEEE');
                    const isWknd = day.getDay() === 0 || day.getDay() === 6;
                    const isOutsideMonth = currentPeriod && (isBefore(day, currentPeriod.start) || isAfter(day, currentPeriod.end));
                    const entry = getEntryForDate(dateStr);

                    return (
                      <tr key={dateStr} className={`border-b border-slate-50 ${isOutsideMonth ? 'bg-slate-100/50' : isWknd ? 'bg-slate-50/60' : 'hover:bg-slate-50/80'} transition-colors`}>
                        <td className="px-2 py-1.5">
                          <p className={`text-[12px] font-medium ${isOutsideMonth ? 'text-slate-300' : isWknd ? 'text-slate-400' : 'text-slate-700'}`}>
                            {format(day, 'EEE, MMM d')}
                          </p>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={entry?.workItem || entry?.work_item || ''}
                            onChange={(e) => updateEntry(dateStr, dayName, 'workItem', e.target.value)}
                            placeholder={isWknd ? '—' : 'Work item...'}
                            className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={entry?.description || ''}
                            onChange={(e) => updateEntry(dateStr, dayName, 'description', e.target.value)}
                            placeholder={isWknd ? '—' : 'Description...'}
                            className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            value={entry?.hours || ''}
                            onChange={(e) => updateEntry(dateStr, dayName, 'hours', e.target.value)}
                            placeholder="0"
                            className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 text-right tabular-nums placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-100 sticky bottom-0">
              <div className="text-[12px] text-slate-500">
                <StatusBadge status={editingEmployee.status} />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingEmployee(null)}
                  className="h-9 px-4 rounded-xl text-[12px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-9 px-5 rounded-xl text-[12px] font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-600/25 flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
