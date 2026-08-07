import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileCheck, CheckCircle2, Clock, Send, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

const STATUS_BADGE = {
  approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  submitted: { label: 'Submitted', tone: 'bg-blue-50 text-blue-700', icon: Send },
  saved: { label: 'Draft', tone: 'bg-slate-100 text-slate-500', icon: Clock },
  rejected: { label: 'Rejected', tone: 'bg-red-50 text-red-700', icon: Clock },
};

export default function ClientTimesheets() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/timesheets')
      .then(d => { setRows(d.timesheets || []); setVendors(d.vendors || []); })
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const periods = useMemo(() => [...new Set(rows.map(r => r.period_label))].sort(), [rows]);
  const projects = useMemo(() => [...new Set(rows.map(r => r.user_project).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(t => {
      if (vendorFilter && t.vendor_name !== vendorFilter) return false;
      if (projectFilter && t.user_project !== projectFilter) return false;
      if (periodFilter && t.period_label !== periodFilter) return false;
      if (statusFilter && (t.status || 'submitted') !== statusFilter) return false;
      if (q && !t.user_name?.toLowerCase().includes(q) && !t.user_project?.toLowerCase().includes(q) && !(t.vendor_name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, vendorFilter, projectFilter, periodFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const submitted = rows.filter(t => t.status === 'submitted').length;
    const approved = rows.filter(t => t.status === 'approved').length;
    return { submitted, approved, total: rows.length };
  }, [rows]);

  return (
    <>
      <PageHeader
        icon={FileCheck}
        title="Timesheets"
        subtitle="View submitted timesheets from the delivery team for your engagements"
      />

      {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
          <p className="text-[22px] font-bold text-slate-900 mt-1">{counts.total}</p>
        </div>
        <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Submitted</p>
          <p className="text-[22px] font-bold text-blue-800 mt-1">{counts.submitted}</p>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Approved</p>
          <p className="text-[22px] font-bold text-emerald-800 mt-1">{counts.approved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Resource, project, vendor…"
              className="w-full h-8 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-[12px] focus:outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="">All Periods</option>
            {periods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading timesheets…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileCheck} title="No timesheets found" description="Submitted timesheets from the delivery team will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Employee</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Vendor</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Period</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Hours</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const sb = STATUS_BADGE[t.status] || STATUS_BADGE.submitted;
                  const StatusIcon = sb.icon;
                  const isExpanded = expandedId === t.id;
                  const entries = (t.entries || []).filter(e => e.hours > 0).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                  return (
                    <React.Fragment key={t.id}>
                      <tr className={`border-b border-slate-100 hover:bg-slate-50/40 cursor-pointer ${isExpanded ? 'bg-slate-50/60' : ''}`} onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                            {t.user_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px]">
                          {t.vendor_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/10">{t.vendor_name}</span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-[12px]">{t.user_project || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-[12px]">{t.period_label}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{Math.round(t.total_hours || 0)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${sb.tone}`}>
                            <StatusIcon size={10} strokeWidth={2.5} /> {sb.label}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="bg-slate-50/80 border-b border-slate-200/50 px-6 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Daily Entries — {t.user_name}</p>
                              {entries.length === 0 ? (
                                <p className="text-[12px] text-slate-400 py-2">No entries recorded.</p>
                              ) : (
                                <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
                                  <table className="w-full text-[12px]">
                                    <thead>
                                      <tr className="bg-slate-50/60 border-b border-slate-100">
                                        <th className="text-left font-semibold text-slate-500 px-3 py-2">Date</th>
                                        <th className="text-left font-semibold text-slate-500 px-3 py-2">Day</th>
                                        <th className="text-right font-semibold text-slate-500 px-3 py-2">Hours</th>
                                        <th className="text-left font-semibold text-slate-500 px-3 py-2">Work Item</th>
                                        <th className="text-left font-semibold text-slate-500 px-3 py-2">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {entries.map((e, i) => {
                                        const d = new Date(e.date + 'T00:00:00');
                                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                                        return (
                                          <tr key={i} className="border-b border-slate-50 last:border-0">
                                            <td className="px-3 py-1.5 tabular-nums text-slate-700">{e.date}</td>
                                            <td className="px-3 py-1.5 text-slate-500">{dayName}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800">{e.hours}</td>
                                            <td className="px-3 py-1.5 text-slate-600">{e.work_item || '—'}</td>
                                            <td className="px-3 py-1.5 text-slate-400 max-w-[200px] truncate" title={e.notes || e.description || ''}>{e.notes || e.description || '—'}</td>
                                          </tr>
                                        );
                                      })}
                                      <tr className="bg-slate-50/60 border-t border-slate-200/50">
                                        <td className="px-3 py-1.5 font-bold text-slate-700" colSpan={2}>Total</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums font-bold text-slate-900">{entries.reduce((s, e) => s + (e.hours || 0), 0)}</td>
                                        <td colSpan={2}></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
        Timesheets are submitted by the delivery team and added by the VCC admin team. This is a read-only view of the hours logged against your engagements.
      </p>
    </>
  );
}
