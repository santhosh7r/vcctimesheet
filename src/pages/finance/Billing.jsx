import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const BILLING_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'monthly_retainer', label: 'Monthly Retainer' },
  { value: 'fixed', label: 'Fixed Bid' },
];
const CURRENCIES = ['USD', 'INR', 'AED', 'EUR'];

const empty = { id: '', name: '', client_id: '', billing_type: 'hourly', bill_rate: 50, currency: 'USD', status: 'active', notes: '' };

const fmtRate = (r) => {
  if (!r.bill_rate) return '—';
  const sym = r.currency === 'INR' ? '₹' : r.currency === 'EUR' ? '€' : r.currency === 'AED' ? 'AED ' : '$';
  const suffix = r.billing_type === 'hourly' ? '/hr' : r.billing_type === 'monthly_retainer' ? '/mo' : ' fixed';
  return `${sym}${Number(r.bill_rate).toLocaleString()}${suffix}`;
};

export default function FinanceBilling() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [sowRates, setSowRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [billingView, setBillingView] = useState('sow'); // 'sow' or 'projects'
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/billable-projects'),
      api.get('/clients'),
      api.get('/users?include_all=true'),
    ])
      .then(([p, c, u]) => {
        setRows(p.projects || []);
        setClients(c.clients || []);
        // Extract employees with SOW rates
        const employees = (u.users || []).filter(usr => usr.hourly_rate && usr.role === 'employee');
        setSowRates(employees.sort((a, b) => (a.project || '').localeCompare(b.project || '') || a.name.localeCompare(b.name)));
      })
      .catch(() => { setRows([]); setClients([]); setSowRates([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientName = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(r => !clientFilter || r.client_id === clientFilter)
      .filter(r => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, search, clientFilter]);

  const open = (r) => {
    if (r) { setEditingId(r.id); setForm({ ...empty, ...r }); }
    else { setEditingId(null); setForm({ ...empty, client_id: clients[0]?.id || '' }); }
    setError(''); setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    if (!form.client_id) { setError('Client is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, bill_rate: Number(form.bill_rate) || 0 };
      if (editingId) await api.put(`/billable-projects/${editingId}`, payload);
      else await api.post('/billable-projects', payload);
      setModalOpen(false); load();
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete project "${r.name}"? Existing invoice line items will keep their snapshot.`)) return;
    await api.del(`/billable-projects/${r.id}`).catch(() => {});
    load();
  };

  return (
    <>
      <PageHeader
        icon={DollarSign}
        title="Client Billing"
        subtitle="Project rate cards — what we bill clients per project"
        actions={
          <button
            onClick={() => open(null)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700"
          >
            <Plus size={16} strokeWidth={2.2} />
            New Rate Card
          </button>
        }
      />

      {/* View toggle */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1 mb-4">
        <button onClick={() => setBillingView('sow')} className={`px-4 h-9 rounded-lg text-[12px] font-semibold transition-all ${billingView === 'sow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          SOW Rates (Per Resource)
        </button>
        <button onClick={() => setBillingView('projects')} className={`px-4 h-9 rounded-lg text-[12px] font-semibold transition-all ${billingView === 'projects' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Project Rate Cards
        </button>
      </div>

      {billingView === 'sow' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Users size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">SOW Billing Rates — Per Resource</h3>
          </div>
          {loading ? (
            <div className="p-12 text-center text-[13px] text-slate-400">Loading rates…</div>
          ) : sowRates.length === 0 ? (
            <EmptyState icon={DollarSign} title="No SOW rates found" description="Set hourly rates on employee profiles to see them here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200/70">
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Employee</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">ID</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">SOW Rate ($/hr)</th>
                  </tr>
                </thead>
                <tbody>
                  {sowRates.map(emp => (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{emp.name}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-[12px]">{emp.id}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-[12px]">{emp.project || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">${emp.hourly_rate}/hr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {billingView === 'projects' && (<>
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-amber-500"
          />
        </div>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]">
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading rate cards…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={DollarSign} title="No rate cards yet" description="Add a project + billing rate to start tracking client revenue." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Client</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Type</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Rate</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600">{clientName[r.client_id] || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{r.billing_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{fmtRate(r)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${r.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-slate-100 text-slate-500 ring-slate-500/10'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => open(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50"><Pencil size={14} strokeWidth={1.8} /></button>
                        <button onClick={() => remove(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} strokeWidth={1.8} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      </>)}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Rate Card' : 'New Rate Card'} maxWidth="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Project Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. VCC - Salesforce" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
            <p className="text-[10px] text-slate-400 mt-1">Match this to the project name shown on employees' timesheet entries to drive revenue calc.</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client *</label>
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Type</label>
              <select value={form.billing_type} onChange={(e) => setForm({ ...form, billing_type: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
                {BILLING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Rate *</label>
              <input type="number" min="0" step="0.01" value={form.bill_rate} onChange={(e) => setForm({ ...form, bill_rate: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60">
              {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
