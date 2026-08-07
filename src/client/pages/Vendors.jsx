import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Mail, Phone, MapPin, Tag, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const STATUS_STYLE = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  inactive: 'bg-slate-100 text-slate-500 ring-slate-400/10',
};

const EMPTY_FORM = {
  name: '', category: '', contact_name: '', contact_email: '', phone: '',
  region: '', status: 'active', engagement_start: '', notes: '',
};

export default function ClientVendors() {
  const { user } = useAuth();
  const canAdd = user?.client_subrole === 'manager';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/vendors')
      .then(d => setRows(d.vendors || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(v => !statusFilter || v.status === statusFilter)
      .filter(v => !q || v.name.toLowerCase().includes(q) || (v.category || '').toLowerCase().includes(q) || (v.contact_name || '').toLowerCase().includes(q));
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter(v => v.status === 'active').length,
    inactive: rows.filter(v => v.status === 'inactive').length,
  }), [rows]);

  const submitVendor = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Vendor name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/vendors', form);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err?.message || 'Failed to add vendor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={Building2}
        title="Vendors"
        subtitle="Third-party suppliers and partners engaged on your account"
        actions={canAdd ? (
          <button
            onClick={() => { setForm(EMPTY_FORM); setError(''); setShowAdd(true); }}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[13px] font-semibold inline-flex items-center gap-2 shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800"
          >
            <Plus size={14} strokeWidth={2.4} />
            Add Vendor
          </button>
        ) : null}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Vendors</p>
          <p className="text-[24px] font-bold text-slate-900 tabular-nums mt-1">{counts.total}</p>
        </div>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Active</p>
          <p className="text-[24px] font-bold text-emerald-700 tabular-nums mt-1">{counts.active}</p>
        </div>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Inactive</p>
          <p className="text-[24px] font-bold text-slate-500 tabular-nums mt-1">{counts.inactive}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, or contact"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-sky-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading vendors…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No vendors match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Vendor</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Category</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Contact</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Region</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Since</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} onClick={() => setSelected(v)} className="border-b border-slate-100 hover:bg-slate-50/40 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-[12px]">{v.category || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{v.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{v.region || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{v.engagement_start || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset capitalize ${STATUS_STYLE[v.status] || STATUS_STYLE.inactive}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} maxWidth="max-w-xl">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset capitalize ${STATUS_STYLE[selected.status] || STATUS_STYLE.inactive}`}>
                {selected.status}
              </span>
              {selected.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600">
                  <Tag size={11} strokeWidth={2} />
                  {selected.category}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Primary Contact</p>
                <p className="text-[14px] font-semibold text-slate-800 mt-0.5">{selected.contact_name || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Engagement Start</p>
                <p className="text-[14px] font-semibold text-slate-800 mt-0.5">{selected.engagement_start || '—'}</p>
              </div>
              {selected.contact_email && (
                <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" strokeWidth={2} />
                  <a href={`mailto:${selected.contact_email}`} className="text-[13px] text-sky-700 hover:underline truncate">{selected.contact_email}</a>
                </div>
              )}
              {selected.phone && (
                <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" strokeWidth={2} />
                  <span className="text-[13px] text-slate-700">{selected.phone}</span>
                </div>
              )}
              {selected.region && (
                <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2 md:col-span-2">
                  <MapPin size={14} className="text-slate-400" strokeWidth={2} />
                  <span className="text-[13px] text-slate-700">{selected.region}</span>
                </div>
              )}
            </div>

            {selected.notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Notes</p>
                <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3">{selected.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setSelected(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Vendor" maxWidth="max-w-2xl">
        <form onSubmit={submitVendor} className="space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Vendor name *" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
            <Field label="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} placeholder="Staffing, Software, Consulting…" />
            <Field label="Primary contact" value={form.contact_name} onChange={v => setForm({ ...form, contact_name: v })} />
            <Field label="Contact email" type="email" value={form.contact_email} onChange={v => setForm({ ...form, contact_email: v })} />
            <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
            <Field label="Region" value={form.region} onChange={v => setForm({ ...form, region: v })} />
            <Field label="Engagement start" type="date" value={form.engagement_start} onChange={v => setForm({ ...form, engagement_start: v })} />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full p-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowAdd(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[13px] font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60">
              {saving ? 'Saving…' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500"
      />
    </div>
  );
}
