import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, AlertTriangle, Search, Download } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

function recommendation(item) {
  if (item.recent_hours === 0) return { label: 'Reassign or release', tone: 'red' };
  if (item.recent_hours < 20) return { label: 'Find utilization', tone: 'amber' };
  return { label: 'Monitor', tone: 'slate' };
}

const TONE = {
  red: 'bg-red-50 text-red-700 ring-red-600/10',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  slate: 'bg-slate-50 text-slate-600 ring-slate-500/10',
};

export default function FinanceBench() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/finance/bench-analysis')
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items || []).filter(i => !q || i.user_name.toLowerCase().includes(q) || (i.project || '').toLowerCase().includes(q));
  }, [data, search]);

  const downloadCsv = () => {
    const header = ['Employee ID', 'Name', 'Project', 'Designation', 'Recent Hours (30d)', 'Last Entry', 'Annual Salary (USD)', 'Monthly Cost (USD)', 'Status', 'Recommendation'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const i of filtered) {
      lines.push([i.user_id, i.user_name, i.project || '', i.designation || '', i.recent_hours, i.last_entry || '', i.annual_salary_usd.toFixed(0), i.monthly_cost_usd.toFixed(0), i.status, recommendation(i).label].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bench-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        icon={TrendingDown}
        title="Bench Analysis"
        subtitle="Underutilized employees + monthly burn — informs reassignment / release decisions"
        actions={
          <button onClick={downloadCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50">
            <Download size={14} strokeWidth={2.2} />
            Export CSV
          </button>
        }
      />

      {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200/70 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-600" strokeWidth={2} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">On Bench</span>
          </div>
          <p className="text-[28px] font-bold text-slate-900 tracking-[-0.02em]">{data?.totals?.count || 0}</p>
          <p className="text-[11px] text-slate-400 mt-1">&lt; 40 hours logged in last 30 days</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-amber-50/40 border border-amber-200/40 rounded-2xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 mb-2">Monthly Burn</p>
          <p className="text-[28px] font-bold text-amber-900 tabular-nums tracking-[-0.02em]">{fmtMoney(data?.totals?.monthly_cost_usd || 0)}</p>
          <p className="text-[11px] text-amber-700/70 mt-1">salary cost while not billing</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-red-50/40 border border-red-200/40 rounded-2xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700 mb-2">Annualized</p>
          <p className="text-[28px] font-bold text-red-900 tabular-nums tracking-[-0.02em]">{fmtMoney(data?.totals?.annual_cost_usd || 0)}</p>
          <p className="text-[11px] text-red-700/70 mt-1">if bench state continues</p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by employee or project" className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-amber-500" />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Crunching utilization numbers…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={TrendingDown} title="No one on bench" description="All active employees have logged ≥ 40 hours in the last 30 days." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Employee</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Hours (30d)</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Last Entry</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Annual Salary</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Monthly Cost</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(it => {
                  const rec = recommendation(it);
                  const utilizationPct = it.recent_hours / 160 * 100;
                  return (
                    <tr key={it.user_id} className="border-b border-slate-100 hover:bg-slate-50/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{it.user_name}</div>
                        <div className="text-[10px] text-slate-400">{it.user_id} · {it.designation || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]" title={it.project}>{it.project || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full ${utilizationPct < 25 ? 'bg-red-500' : utilizationPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, utilizationPct)}%` }} />
                          </div>
                          <span className="tabular-nums font-semibold text-slate-700">{Math.round(it.recent_hours)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[12px]">{it.last_entry || 'never'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{it.annual_salary_usd > 0 ? fmtMoney(it.annual_salary_usd) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{it.monthly_cost_usd > 0 ? fmtMoney(it.monthly_cost_usd) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${TONE[rec.tone]}`}>{rec.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
        Bench heuristic: &lt; 40 billable hours in the last 30 days OR explicit "bench" employee status.
        Monthly cost converts CTC to annual USD using indicative FX (₹83 / 3.67 AED per USD) and divides by 12.
      </p>
    </>
  );
}
