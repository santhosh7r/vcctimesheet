import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Search, RefreshCw, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const ACTION_COLORS = {
  login: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  login_failed: 'bg-red-50 text-red-700 ring-red-600/10',
  create_user: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  update_user: 'bg-violet-50 text-violet-700 ring-violet-600/10',
  delete_user: 'bg-red-50 text-red-700 ring-red-600/10',
  set_password: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  upsert_salary: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  update_salary: 'bg-violet-50 text-violet-700 ring-violet-600/10',
  delete_salary: 'bg-red-50 text-red-700 ring-red-600/10',
  view_salaries: 'bg-slate-50 text-slate-600 ring-slate-500/10',
};

const DEFAULT_COLOR = 'bg-slate-50 text-slate-600 ring-slate-500/10';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    params.set('limit', '500');
    api.get(`/audit-logs?${params}`)
      .then(d => setLogs(d.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [actionFilter]);

  const actions = useMemo(() => {
    const set = new Set(logs.map(l => l.action));
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(l =>
      l.action?.toLowerCase().includes(q) ||
      l.user_name?.toLowerCase().includes(q) ||
      l.user_id?.toLowerCase().includes(q) ||
      l.target_id?.toLowerCase().includes(q) ||
      l.target_type?.toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <>
      <PageHeader
        icon={ScrollText}
        title="Audit Logs"
        subtitle="Track all user actions across the platform"
        actions={
          <button
            onClick={fetchLogs}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <RefreshCw size={14} strokeWidth={2.2} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, or target"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500"
        >
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[12px] text-slate-400">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading audit logs…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No audit logs found" description="Actions will appear here as users interact with the system." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Time</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">User</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Role</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Action</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Target</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[12px]">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{log.user_name || '—'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{log.user_id || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize text-[12px]">{log.user_role || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${ACTION_COLORS[log.action] || DEFAULT_COLOR}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.target_type && (
                        <span className="text-[12px]">
                          <span className="text-slate-400">{log.target_type}</span>
                          {log.target_id && <span className="font-mono ml-1">{log.target_id}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[300px] truncate" title={JSON.stringify(log.details)}>
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </>
  );
}
