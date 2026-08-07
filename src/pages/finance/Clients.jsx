import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const REGIONS = ['India', 'USA', 'UAE', 'Europe', 'Other'];
const empty = { id: '', name: '', region: 'USA', contact_name: '', contact_email: '', status: 'active', notes: '' };

export default function FinanceClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/clients')
      .then(d => setClients(d.clients || []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search]);

  const open = (c) => {
    if (c) { setEditingId(c.id); setForm({ ...empty, ...c }); }
    else { setEditingId(null); setForm(empty); }
    setError(''); setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      if (editingId) await api.put(`/clients/${editingId}`, form);
      else await api.post('/clients', form);
      setModalOpen(false); load();
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete client "${c.name}"? This cannot be undone.`)) return;
    await api.del(`/clients/${c.id}`).catch(() => {});
    load();
  };

  return (
    <>
      <PageHeader
        icon={Building2}
        title="Clients"
        subtitle="Manage client records that own your billable projects"
        actions={
          <button
            onClick={() => open(null)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 transition-all"
          >
            <Plus size={16} strokeWidth={2.2} />
            New Client
          </button>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading clients…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No clients yet" description="Create your first client to start billing." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">ID</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Name</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Region</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Contact</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{c.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.region || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.contact_email || c.contact_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-slate-100 text-slate-500 ring-slate-500/10'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => open(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                          <Pencil size={14} strokeWidth={1.8} />
                        </button>
                        <button onClick={() => remove(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Client' : 'New Client'} maxWidth="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client ID</label>
              <input value={form.id} disabled={!!editingId} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="auto" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500 disabled:bg-slate-50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Region</label>
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Contact Name</label>
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full p-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60">
              {saving ? 'Saving…' : editingId ? 'Save' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
