import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isWeekend as dateFnsIsWeekend } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, Send, Info, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTimesheets } from '../../context/TimesheetContext';
import { getFortnightlyPeriods, getDaysInRange } from '../../data/mockData';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';

export default function Timesheet() {
  const { user } = useAuth();
  const { saveTimesheet, submitTimesheet, getTimesheet, isPeriodFrozen, loaded } = useTimesheets();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [periodIndex, setPeriodIndex] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedRows, setSavedRows] = useState({});

  const periods = useMemo(() => getFortnightlyPeriods(year, month), [year, month]);
  const currentPeriod = periods[periodIndex];
  const days = useMemo(() => getDaysInRange(currentPeriod.start, currentPeriod.end), [currentPeriod]);

  const existingData = getTimesheet(user.id, currentPeriod.label);
  const frozen = isPeriodFrozen(currentPeriod.label);
  const isSubmitted = existingData?.status === 'submitted';
  const isLocked = frozen || isSubmitted;

  const buildEntries = (d, existing) => {
    if (existing?.entries) return existing.entries;
    return d.map((date) => ({
      date: format(date, 'yyyy-MM-dd'),
      dayName: format(date, 'EEEE'),
      workItem: '',
      description: dateFnsIsWeekend(date) ? 'WEEKEND' : '',
      hours: 0,
    }));
  };

  const [entries, setEntries] = useState(() => buildEntries(days, existingData));

  useEffect(() => {
    const data = getTimesheet(user.id, currentPeriod.label);
    setEntries(buildEntries(days, data));
  }, [currentPeriod.label, days, user.id, loaded]);

  const handlePeriodChange = (dir) => {
    const newIdx = periodIndex + dir;
    if (newIdx >= 0 && newIdx < periods.length) {
      setPeriodIndex(newIdx);
    } else if (dir === -1) {
      const newMonth = month === 0 ? 11 : month - 1;
      const newYear = month === 0 ? year - 1 : year;
      setMonth(newMonth);
      setYear(newYear);
      // Jump to last period of previous month
      const prevPeriods = getFortnightlyPeriods(newYear, newMonth);
      setPeriodIndex(prevPeriods.length - 1);
    } else {
      setMonth(month === 11 ? 0 : month + 1);
      setYear(month === 11 ? year + 1 : year);
      setPeriodIndex(0);
    }
  };

  const updateEntry = (index, field, value) => {
    if (isLocked) return;
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
  const canSubmit = entries.every((e) => {
    const d = new Date(e.date);
    if (dateFnsIsWeekend(d)) return true;
    return (parseFloat(e.hours) || 0) > 0;
  }) && totalHours > 0;

  const handleSaveDay = (index) => {
    saveTimesheet(user.id, currentPeriod.label, entries, 'saved');
    setSavedRows((prev) => ({ ...prev, [index]: true }));
    setTimeout(() => setSavedRows((prev) => ({ ...prev, [index]: false })), 2000);
  };

  const handleSave = () => {
    saveTimesheet(user.id, currentPeriod.label, entries, 'saved');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleSubmit = () => {
    saveTimesheet(user.id, currentPeriod.label, entries, 'submitted');
    submitTimesheet(user.id, currentPeriod.label);
    setShowSubmitConfirm(false);
  };

  const status = existingData?.status || 'pending';

  return (
    <div>
      <PageHeader
        title="My Timesheet"
        subtitle={`${user.name} \u2014 ${user.project}`}
        icon={Clock}
        actions={<StatusBadge status={frozen ? 'frozen' : status} />}
      />

      {/* Period navigation */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
        <Card className="mb-6 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <Calendar size={18} className="text-white" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Project</p>
                <p className="font-semibold text-slate-900 text-[13px]">{user.project}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePeriodChange(-1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 transition-all border border-slate-200/60"
              >
                <ChevronLeft size={16} className="text-slate-500" />
              </button>
              <div className="min-w-[260px] text-center px-5 py-2 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[13px] font-bold text-slate-800">{currentPeriod.label}</span>
              </div>
              <button
                onClick={() => handlePeriodChange(1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 transition-all border border-slate-200/60"
              >
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Hours</p>
              <motion.p
                key={totalHours}
                initial={{ scale: 1.15, color: '#4f46e5' }}
                animate={{ scale: 1, color: '#0f172a' }}
                transition={{ duration: 0.3 }}
                className="text-[26px] font-bold text-slate-900 tabular-nums leading-tight"
              >
                {totalHours}
              </motion.p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Timesheet table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
        <Card className="overflow-hidden mb-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 w-[105px]">Date</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 w-[70px]">Day</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 w-[160px]">Project</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 w-[180px]">Work Item</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 min-w-[250px]">Description</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 w-[100px]">Hours</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 w-[90px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const isWknd = dateFnsIsWeekend(new Date(entry.date));
                  const hasHours = (parseFloat(entry.hours) || 0) > 0;
                  return (
                    <motion.tr
                      key={entry.date}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025, duration: 0.3 }}
                      className={`border-b border-slate-100/80 group transition-all duration-150 ${
                        isWknd
                          ? 'bg-slate-50/70'
                          : hasHours
                          ? 'bg-accent-50/20 hover:bg-accent-50/40'
                          : 'hover:bg-primary-50/20'
                      }`}
                    >
                      <td className="px-5 py-2.5">
                        <span className="text-[13px] font-medium text-slate-800 tabular-nums">
                          {format(new Date(entry.date), 'M/d/yyyy')}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`text-[12px] font-semibold ${isWknd ? 'text-slate-300' : 'text-slate-500'}`}>
                          {entry.dayName.slice(0, 3)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="text-[12px] text-slate-400 truncate block max-w-[150px]">{user.project}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="text"
                          value={entry.workItem}
                          onChange={(e) => updateEntry(i, 'workItem', e.target.value)}
                          disabled={isLocked || isWknd}
                          placeholder={isWknd ? '--' : 'Work item'}
                          className="w-full h-8 px-3 rounded-lg border border-slate-200/80 bg-white text-[13px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-primary-400 focus:ring-3 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-transparent transition-all duration-200"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) => updateEntry(i, 'description', e.target.value)}
                          disabled={isLocked || isWknd}
                          placeholder={isWknd ? '' : 'Description'}
                          className="w-full h-8 px-3 rounded-lg border border-slate-200/80 bg-white text-[13px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-primary-400 focus:ring-3 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-transparent transition-all duration-200"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={entry.hours}
                          onChange={(e) => updateEntry(i, 'hours', e.target.value)}
                          disabled={isLocked || isWknd}
                          className="w-full h-8 px-3 rounded-lg border border-slate-200/80 bg-white text-[13px] font-bold text-slate-800 text-right tabular-nums focus:outline-none focus:border-primary-400 focus:ring-3 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-transparent disabled:font-normal transition-all duration-200"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        {isWknd ? (
                          <span className="text-[11px] text-slate-300">--</span>
                        ) : savedRows[i] ? (
                          <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-[11px] text-accent-600 font-semibold">
                            Saved!
                          </motion.span>
                        ) : (
                          <button
                            onClick={() => handleSaveDay(i)}
                            disabled={isLocked}
                            title="Save this day"
                            className="h-7 px-3 rounded-lg text-[11px] font-semibold border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center gap-1"
                          >
                            <Save size={12} strokeWidth={2} />
                            Save
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* Footer */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 max-w-md">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                <Info size={14} className="text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Fill all weekday hours before submitting. Timesheet locks after final submission.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <AnimatePresence>
                {justSaved && (
                  <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="text-[12px] text-accent-600 font-semibold mr-2">
                    Saved successfully
                  </motion.span>
                )}
              </AnimatePresence>
              <button
                onClick={handleSave}
                disabled={isLocked}
                className="h-10 px-5 rounded-xl text-[13px] font-semibold border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                <Save size={15} strokeWidth={2} />
                Save Draft
              </button>
              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={isLocked || !canSubmit}
                className="h-10 px-6 rounded-xl text-[13px] font-semibold bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg shadow-primary-600/25"
              >
                <Send size={15} strokeWidth={2} />
                Final Submit
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Confirm modal */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[6px] flex items-center justify-center z-50 p-4"
            onClick={() => setShowSubmitConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] border border-slate-200/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-5 shadow-lg shadow-primary-600/20">
                <Send size={20} className="text-white" />
              </div>
              <h3 className="text-[18px] font-bold text-slate-900 mb-2 tracking-[-0.01em]">Confirm submission</h3>
              <p className="text-[13px] text-slate-500 mb-7 leading-relaxed">
                This action cannot be undone. Your timesheet for <strong className="text-slate-800 font-semibold">{totalHours} hours</strong> will be locked for review.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="h-10 px-5 rounded-xl text-[13px] font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="h-10 px-6 rounded-xl text-[13px] font-semibold bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-600/25"
                >
                  Submit Timesheet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
