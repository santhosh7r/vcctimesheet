import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Download, Calendar, Users, Check, X, Pencil, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const GRANULARITIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

// ISO week number (1..53) — Monday-start week.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

function bucketKey(dateIso, granularity) {
  if (granularity === 'daily') return dateIso;
  const d = new Date(dateIso);
  if (granularity === 'monthly') return dateIso.slice(0, 7); // YYYY-MM
  const { year, week } = isoWeek(d);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function bucketLabel(key, granularity) {
  if (granularity === 'monthly') {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (granularity === 'weekly') return key.replace('-W', ' · Week ');
  return key;
}

const VIEWS = [
  { value: 'time', label: 'Time Series' },
  { value: 'resource', label: 'Resource Wise' },
  { value: 'project', label: 'Project Totals' },
];

export default function FinanceReports() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('time');
  const [granularity, setGranularity] = useState('weekly');
  const [project, setProject] = useState('');
  const [from, setFrom] = useState(addDays(todayIso(), -90));
  const [to, setTo] = useState(todayIso());
  const [resourceSearch, setResourceSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [editError, setEditError] = useState('');
  const editInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/finance/summary?from=${from}&to=${to}`)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const projectList = useMemo(() => Object.keys(summary?.by_project_day || {}).sort(), [summary]);

  // Pivot the chosen project's daily series into the chosen granularity.
  // If "All projects", aggregate across the by_day series.
  const rows = useMemo(() => {
    if (!summary) return [];
    let series = [];
    if (project) {
      series = summary.by_project_day?.[project] || [];
    } else {
      series = summary.by_day || [];
    }
    const buckets = {};
    for (const d of series) {
      const k = bucketKey(d.date, granularity);
      if (!buckets[k]) buckets[k] = { key: k, label: bucketLabel(k, granularity), hours: 0, revenue: 0, payout: 0, days: 0 };
      buckets[k].hours += d.hours;
      buckets[k].revenue += d.revenue;
      buckets[k].payout += d.payout;
      buckets[k].days += 1;
    }
    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
  }, [summary, project, granularity]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    hours: acc.hours + r.hours,
    revenue: acc.revenue + r.revenue,
    payout: acc.payout + r.payout,
  }), { hours: 0, revenue: 0, payout: 0 }), [rows]);

  const projectTotals = useMemo(() => {
    if (!summary) return [];
    return (summary.by_project || []).slice().sort((a, b) => b.revenue - a.revenue);
  }, [summary]);

  const resourceRows = useMemo(() => {
    if (!summary) return [];
    const employees = summary.by_employee || [];
    const q = resourceSearch.trim().toLowerCase();
    return employees
      .filter(e => !q || e.user_name?.toLowerCase().includes(q) || e.project?.toLowerCase().includes(q))
      .sort((a, b) => b.revenue - a.revenue);
  }, [summary, resourceSearch]);

  const resourceTotals = useMemo(() => resourceRows.reduce((acc, r) => ({
    hours: acc.hours + r.hours,
    revenue: acc.revenue + r.revenue,
    payout: acc.payout + r.payout,
  }), { hours: 0, revenue: 0, payout: 0 }), [resourceRows]);

  const beginEdit = (row) => {
    setEditingId(row.user_id);
    setEditValue(row.cost_rate ? String(Math.round(row.cost_rate)) : '');
    setEditError('');
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditError('');
  };

  // Save inline cost-rate edit. We store as annual USD CTC (rate × 2080 hrs/yr)
  // in the employee_salaries table so the calc reads it back consistently.
  const saveEdit = async (row) => {
    const num = Number(editValue);
    if (!Number.isFinite(num) || num < 0) { setEditError('Enter a valid hourly rate'); return; }
    setSavingId(row.user_id);
    setEditError('');
    try {
      const [first_name, ...rest] = (row.user_name || '').trim().split(/\s+/);
      const last_name = rest.join(' ') || '';
      await api.post('/employee-salaries', {
        id: row.user_id,
        first_name: first_name || row.user_name || row.user_id,
        last_name,
        ctc_amount: num * 2080,
        ctc_currency: 'USD',
        ctc_period: 'annual',
        ctc_raw: `Manually set via Finance Reports: $${num}/hr`,
      });
      setEditingId(null);
      setEditValue('');
      load();
    } catch (err) {
      setEditError(err?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const downloadCsv = () => {
    const header = ['Period', 'Hours', 'Revenue', 'Payout', 'Margin', 'Margin %'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      const margin = r.revenue - r.payout;
      const pct = r.revenue > 0 ? ((margin / r.revenue) * 100).toFixed(1) : '0.0';
      lines.push([r.label, r.hours, r.revenue.toFixed(2), r.payout.toFixed(2), margin.toFixed(2), `${pct}%`].map(escape).join(','));
    }
    lines.push('');
    lines.push(['TOTAL', totals.hours, totals.revenue.toFixed(2), totals.payout.toFixed(2), (totals.revenue - totals.payout).toFixed(2), totals.revenue > 0 ? `${((totals.revenue - totals.payout) / totals.revenue * 100).toFixed(1)}%` : '0.0%'].map(escape).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const proj = project ? project.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'all-projects';
    a.href = url;
    a.download = `report-${proj}-${granularity}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadProjectTotalsCsv = () => {
    const header = ['Project', 'Hours', 'Revenue', 'Payout', 'Margin', 'Margin %'];
    const lines = [header.join(',')];
    for (const p of projectTotals) {
      const margin = p.revenue - p.payout;
      const pct = p.revenue > 0 ? ((margin / p.revenue) * 100).toFixed(1) : '0.0';
      lines.push([`"${p.project}"`, p.hours, p.revenue.toFixed(2), p.payout.toFixed(2), margin.toFixed(2), `${pct}%`].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-totals-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        icon={FileSpreadsheet}
        title="Finance Reports"
        subtitle="Project-wise revenue breakdowns — daily, weekly, monthly"
        actions={
          <button onClick={downloadCsv} disabled={!rows.length} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50">
            <Download size={14} strokeWidth={2.2} />
            Export CSV
          </button>
        }
      />

      {/* View tabs */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            className={`px-4 h-9 rounded-lg text-[12px] font-semibold transition-all ${view === v.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-5 bg-white border border-slate-200/70 rounded-2xl p-4">
        {view === 'time' && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Granularity</label>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {GRANULARITIES.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGranularity(g.value)}
                  className={`px-3 h-8 rounded-lg text-[12px] font-semibold transition-all ${granularity === g.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {view === 'time' && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Project</label>
            <select value={project} onChange={(e) => setProject(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
              <option value="">All projects (aggregate)</option>
              {projectList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        {view === 'resource' && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Search</label>
            <input value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder="Search by name or project…" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
          </div>
        )}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
        </div>
      </div>

      {/* Summary cards */}
      {(() => {
        const t = view === 'resource' ? resourceTotals : totals;
        const loss = Math.max(0, t.payout - t.revenue);
        const margin = t.revenue - t.payout;
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{view === 'time' ? 'Periods' : view === 'resource' ? 'Resources' : 'Projects'}</p>
              <p className="text-[24px] font-bold text-slate-900 mt-1 tracking-[-0.02em]">{view === 'time' ? rows.length : view === 'resource' ? resourceRows.length : projectTotals.length}</p>
            </div>
            <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hours</p>
              <p className="text-[24px] font-bold text-slate-900 mt-1 tabular-nums tracking-[-0.02em]">{Math.round(t.hours)}</p>
            </div>
            <div className="bg-emerald-50/40 border border-emerald-200/40 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Revenue</p>
              <p className="text-[20px] font-bold text-emerald-800 mt-1 tabular-nums tracking-[-0.02em]">{fmtMoney(t.revenue)}</p>
            </div>
            <div className="bg-red-50/40 border border-red-200/40 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Loss</p>
              <p className="text-[20px] font-bold text-red-800 mt-1 tabular-nums tracking-[-0.02em]">{fmtMoney(t.payout)}</p>
              <p className="text-[10px] text-red-700/70 mt-0.5">Salary + 17% overhead</p>
            </div>
            <div className={`${margin >= 0 ? 'bg-amber-50/40 border-amber-200/40' : 'bg-red-50/40 border-red-200/40'} border rounded-2xl p-4`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${margin >= 0 ? 'text-amber-700' : 'text-red-700'}`}>Margin</p>
              <p className={`text-[20px] font-bold mt-1 tabular-nums tracking-[-0.02em] ${margin >= 0 ? 'text-amber-800' : 'text-red-800'}`}>{fmtMoney(margin)}</p>
              <p className={`text-[10px] mt-0.5 ${margin >= 0 ? 'text-amber-700/70' : 'text-red-700/70'}`}>{t.revenue > 0 ? `${((margin / t.revenue) * 100).toFixed(1)}%` : '—'}</p>
            </div>
          </div>
        );
      })()}

      {/* Time-series table */}
      {view === 'time' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Calendar size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">{project || 'All projects'} · {GRANULARITIES.find(g => g.value === granularity).label}</h3>
          </div>
          {loading ? (
            <div className="p-12 text-center text-[13px] text-slate-400">Loading report…</div>
          ) : rows.length === 0 ? (
            <EmptyState title="No data in this range" description="Try widening the date range or picking a different project." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200/70">
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Period</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Hours</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Revenue</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Loss (Cost)</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Margin</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const margin = r.revenue - r.payout;
                    const pct = r.revenue > 0 ? (margin / r.revenue) * 100 : 0;
                    return (
                      <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50/40">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.label}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{Math.round(r.hours)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{fmtMoney(r.revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{fmtMoney(r.payout)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(margin)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50/60 border-t-2 border-slate-200">
                    <td className="px-4 py-3 font-bold text-slate-900">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{Math.round(totals.hours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtMoney(totals.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-red-600">{fmtMoney(totals.payout)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${(totals.revenue - totals.payout) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(totals.revenue - totals.payout)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-700">{totals.revenue > 0 ? `${((totals.revenue - totals.payout) / totals.revenue * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Resource-wise view */}
      {view === 'resource' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Users size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">Resource-wise Breakdown · {from} to {to}</h3>
          </div>
          {loading ? (
            <div className="p-12 text-center text-[13px] text-slate-400">Loading report…</div>
          ) : resourceRows.length === 0 ? (
            <EmptyState title="No resource data in this range" description="Try widening the date range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200/70">
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Employee</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">SOW Rate</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Cost Rate</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Hours</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Revenue</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Loss (Cost)</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Margin</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceRows.map(r => {
                    const margin = r.revenue - r.payout;
                    const pct = r.revenue > 0 ? (margin / r.revenue) * 100 : 0;
                    return (
                      <tr key={r.user_id} className="border-b border-slate-100 hover:bg-slate-50/40">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{r.user_name}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-[12px]">{r.project || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">${r.rate || 0}/hr</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {editingId === r.user_id ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="text-slate-400 text-[11px]">$</span>
                              <input
                                ref={editInputRef}
                                type="number"
                                min="0"
                                step="1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(r);
                                  else if (e.key === 'Escape') cancelEdit();
                                }}
                                disabled={savingId === r.user_id}
                                className="w-16 h-7 px-1.5 rounded-md border border-amber-400 text-[12px] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-200"
                              />
                              <span className="text-slate-400 text-[11px]">/hr</span>
                              <button onClick={() => saveEdit(r)} disabled={savingId === r.user_id} title="Save"
                                className="w-6 h-6 rounded-md flex items-center justify-center text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
                                {savingId === r.user_id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={2.4} />}
                              </button>
                              <button onClick={cancelEdit} disabled={savingId === r.user_id} title="Cancel"
                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50">
                                <X size={12} strokeWidth={2.4} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => beginEdit(r)} title="Click to edit cost rate"
                              className="group inline-flex items-center gap-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md px-1.5 py-0.5">
                              <span className="tabular-nums">${Math.round(r.cost_rate || 0)}/hr</span>
                              <Pencil size={10} className="opacity-0 group-hover:opacity-100 text-amber-600" />
                            </button>
                          )}
                          {editingId === r.user_id && editError && (
                            <div className="text-[10px] text-red-600 text-right mt-0.5">{editError}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{Math.round(r.hours)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{fmtMoney(r.revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{fmtMoney(r.payout)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(margin)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50/60 border-t-2 border-slate-200">
                    <td className="px-4 py-3 font-bold text-slate-900" colSpan={2}>Total ({resourceRows.length} resources)</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{Math.round(resourceTotals.hours)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">{fmtMoney(resourceTotals.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-red-600">{fmtMoney(resourceTotals.payout)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${(resourceTotals.revenue - resourceTotals.payout) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(resourceTotals.revenue - resourceTotals.payout)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-700">{resourceTotals.revenue > 0 ? `${((resourceTotals.revenue - resourceTotals.payout) / resourceTotals.revenue * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Per-project totals */}
      {view === 'project' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-800">Project totals · {from} to {to}</h3>
            <button onClick={downloadProjectTotalsCsv} disabled={!projectTotals.length} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Download size={12} strokeWidth={2.2} /> Export CSV
            </button>
          </div>
          {projectTotals.length === 0 ? (
            <EmptyState title="No project revenue in this range" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200/70">
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Avg Rate</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Hours</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Revenue</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Loss (Cost)</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Margin</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTotals.map(p => {
                    const margin = p.revenue - p.payout;
                    const pct = p.revenue > 0 ? (margin / p.revenue) * 100 : 0;
                    return (
                      <tr key={p.project} className="border-b border-slate-100 hover:bg-slate-50/40">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{p.project}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">${p.rate || 0}/hr</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{Math.round(p.hours)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{fmtMoney(p.revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{fmtMoney(p.payout)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(margin)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </>
  );
}
