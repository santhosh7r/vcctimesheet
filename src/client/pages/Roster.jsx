import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Mail, MapPin, Briefcase } from 'lucide-react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

const ROLE_BADGE = {
  employee: { label: 'Employee', tone: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  consultant: { label: 'Consultant', tone: 'bg-cyan-50 text-cyan-700 ring-cyan-600/10' },
  manager: { label: 'Manager', tone: 'bg-violet-50 text-violet-700 ring-violet-600/10' },
};

const STATUS_BADGE = {
  active: { label: 'Active', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  inactive: { label: 'Inactive', tone: 'bg-red-50 text-red-700 ring-red-600/10' },
  bench: { label: 'Bench', tone: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
};

const initials = (name) => (name || '').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

export default function ClientRoster() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/roster')
      .then(res => setUsers(res.users || []))
      .catch(e => { setError(e?.message || 'Failed to load'); setUsers([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const projects = useMemo(
    () => [...new Set(users.map(u => u.project).filter(Boolean))].sort(),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (projectFilter && u.project !== projectFilter) return false;
      if (statusFilter && (u.employee_status || 'active') !== statusFilter) return false;
      if (q && !(
        u.name?.toLowerCase().includes(q)
        || u.id?.toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.designation || '').toLowerCase().includes(q)
        || (u.project || '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [users, search, roleFilter, projectFilter, statusFilter]);

  const totals = useMemo(() => {
    const active = users.filter(u => u.is_active !== false);
    return {
      headcount: active.length,
      onProjects: new Set(active.map(u => u.project).filter(Boolean)).size,
      benched: users.filter(u => u.employee_status === 'bench').length,
    };
  }, [users]);

  return (
    <>
      <PageHeader
        icon={Users}
        title="Project Roster"
        subtitle="Resources working on your engagements and their contracted bill rate"
      />

      {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">{error}</div>}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Headcount</p>
          <p className="text-[24px] font-bold text-slate-900 tabular-nums mt-1">{totals.headcount}</p>
        </div>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Projects</p>
          <p className="text-[24px] font-bold text-slate-900 tabular-nums mt-1">{totals.onProjects}</p>
        </div>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">On Bench</p>
          <p className="text-[24px] font-bold text-slate-900 tabular-nums mt-1">{totals.benched}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, role, project…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-[12px] focus:outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="">All Roles</option>
            {Object.entries(ROLE_BADGE).map(([v, r]) => <option key={v} value={v}>{r.label}</option>)}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500 max-w-[200px]"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="bench">Bench</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading roster…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No resources match" description="Try clearing the filters or search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">ID</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Resource</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Role</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Designation</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Location</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Bill Rate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const rb = ROLE_BADGE[u.role] || ROLE_BADGE.employee;
                  const sb = STATUS_BADGE[u.employee_status] || STATUS_BADGE.active;
                  return (
                    <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50/40 ${u.is_active === false ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{u.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <span className="text-white text-[11px] font-bold">{initials(u.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{u.name}</p>
                            {u.email && (
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                                <Mail size={10} strokeWidth={2} /> {u.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${rb.tone}`}>{rb.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[12px]">{u.designation || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-[12px]">
                        {u.project ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                            <Briefcase size={10} strokeWidth={2} /> {u.project}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 capitalize">
                          <MapPin size={10} strokeWidth={2} /> {u.location_type || 'offshore'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${sb.tone}`}>{sb.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {u.hourly_rate > 0 ? <>${u.hourly_rate}<span className="text-[11px] font-medium text-slate-400">/hr</span></> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="mt-3 text-[11px] text-slate-400">
        Bill rate reflects the rate agreed in the active SOW for each resource. Compensation details are not shown in the client portal.
      </p>
    </>
  );
}
