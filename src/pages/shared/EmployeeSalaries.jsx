import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Search, Download, MapPin, Briefcase, Eye, EyeOff, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { fullName, formatCtc, annualizedUsd } from '../../data/employeeSalaries';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';

const LOCATIONS = ['India', 'USA', 'UAE'];
const CURRENCIES = ['INR', 'USD', 'AED'];
const PERIODS = ['annual', 'monthly', 'hourly'];

function maskCtc(text) {
  if (!text || text === '—') return text;
  return text.replace(/\d/g, '•');
}

const emptyForm = {
  id: '', first_name: '', last_name: '', title: '', department: '', location: 'India',
  joined_date: '', ctc_amount: '', ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '',
};

export default function EmployeeSalaries() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const allowed = user?.role === 'admin' || user?.role === 'finance';
  const canEdit = user?.role === 'admin';

  const fetchSalaries = () => {
    if (!allowed) return;
    setLoading(true);
    api.get('/employee-salaries')
      .then(d => setRows(d.salaries || []))
      .catch(e => setError(e?.message || 'Failed to load salaries'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSalaries(); }, [allowed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(r => !locationFilter || r.location === locationFilter)
      .filter(r => !q || fullName(r).toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q))
      .sort((a, b) => (b.joined_date || '').localeCompare(a.joined_date || ''));
  }, [rows, search, locationFilter]);

  const stats = useMemo(() => {
    const byLoc = LOCATIONS.reduce((acc, l) => ({ ...acc, [l]: rows.filter(r => r.location === l).length }), {});
    const totalAnnualUsd = rows.reduce((sum, r) => sum + (annualizedUsd(r) || 0), 0);
    const known = rows.filter(r => r.ctc_amount != null).length;
    return { total: rows.length, byLoc, totalAnnualUsd, known, unknown: rows.length - known };
  }, [rows]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      id: r.id,
      first_name: r.first_name || '',
      last_name: r.last_name || '',
      title: r.title || '',
      department: r.department || '',
      location: r.location || 'India',
      joined_date: r.joined_date || '',
      ctc_amount: r.ctc_amount ?? '',
      ctc_currency: r.ctc_currency || 'INR',
      ctc_period: r.ctc_period || 'annual',
      ctc_raw: r.ctc_raw || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.id.trim() || !form.first_name.trim()) {
      setFormError('Employee ID and First Name are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        ctc_amount: form.ctc_amount === '' ? null : Number(form.ctc_amount),
      };
      if (editingId) {
        await api.put(`/employee-salaries/${editingId}`, payload);
      } else {
        await api.post('/employee-salaries', payload);
      }
      setModalOpen(false);
      fetchSalaries();
    } catch (err) {
      setFormError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete salary record for ${fullName(r)}?`)) return;
    try {
      await api.del(`/employee-salaries/${r.id}`);
      fetchSalaries();
    } catch (err) {
      setError(err?.message || 'Failed to delete');
    }
  };

  const downloadCsv = () => {
    const header = ['Employee ID', 'First Name', 'Last Name', 'Title', 'Location', 'Date of Joining', 'CTC Amount', 'Currency', 'Period', 'Original CTC Text'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of filtered) {
      lines.push([r.id, r.first_name, r.last_name, r.title, r.location, r.joined_date, r.ctc_amount, r.ctc_currency, r.ctc_period, r.ctc_raw].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-salaries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!allowed) {
    return (
      <>
        <PageHeader icon={DollarSign} title="Employee Salaries" subtitle="Restricted" />
        <EmptyState title="Access denied" description="Salary information is visible only to admin and finance roles." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={DollarSign}
        title="Employee Salaries"
        subtitle="HR roster with CTC — visible to admin and finance only"
        actions={
          <>
            <button
              onClick={() => setRevealed(v => !v)}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              title={revealed ? 'Hide amounts' : 'Reveal amounts'}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Download size={14} strokeWidth={2.2} />
              Export CSV
            </button>
            {canEdit && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[12px] font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800 transition-all"
              >
                <Plus size={14} strokeWidth={2.2} />
                Add Record
              </button>
            )}
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
          <p className="text-[24px] font-bold text-slate-900 mt-1 tracking-[-0.02em]">{stats.total}</p>
        </div>
        {LOCATIONS.map(l => (
          <div key={l} className="bg-white border border-slate-200/70 rounded-2xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{l}</p>
            <p className="text-[24px] font-bold text-slate-900 mt-1 tracking-[-0.02em]">{stats.byLoc[l] || 0}</p>
          </div>
        ))}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Annualized (USD)</p>
          <p className="text-[20px] font-bold text-slate-900 mt-1 tabular-nums tracking-[-0.02em]">
            {revealed ? `$${Math.round(stats.totalAnnualUsd).toLocaleString('en-US')}` : '$---'}
          </p>
          <p className="text-[10px] text-amber-700/70 mt-0.5">{stats.unknown} pending</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or title"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
          />
        </div>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500"
        >
          <option value="">All locations</option>
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading salaries…</div>
        ) : error ? (
          <div className="p-12 text-center text-[13px] text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No employees match your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Employee ID</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Name</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Title</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Location</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Joined</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">CTC</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Original</th>
                  {canEdit && <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const formatted = formatCtc(r);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{r.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{fullName(r)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <Briefcase size={12} className="text-slate-400" />
                          {r.title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10">
                          <MapPin size={10} strokeWidth={2} />
                          {r.location}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{r.joined_date}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                        {revealed ? formatted : maskCtc(formatted)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px] italic max-w-[220px] truncate" title={r.ctc_raw}>
                        {revealed ? r.ctc_raw : maskCtc(r.ctc_raw || '')}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(r)}
                              title="Edit"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                            >
                              <Pencil size={14} strokeWidth={1.8} />
                            </button>
                            <button
                              onClick={() => handleDelete(r)}
                              title="Delete"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            >
                              <Trash2 size={14} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
        CTC values are masked by default — click <strong>Reveal</strong> to display amounts. Annualized USD totals use
        approximate FX rates and assume 2,080 working hours per year for hourly rates; treat as indicative only.
      </p>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Salary Record' : 'Add Salary Record'} maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Employee ID *</label>
              <input
                value={form.id}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Location</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              >
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">First Name *</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Last Name</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Title / Designation</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Date of Joining</label>
              <input
                type="date"
                value={form.joined_date}
                onChange={(e) => setForm({ ...form, joined_date: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">CTC Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.ctc_amount}
                onChange={(e) => setForm({ ...form, ctc_amount: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Currency</label>
              <select
                value={form.ctc_currency}
                onChange={(e) => setForm({ ...form, ctc_currency: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Period</label>
              <select
                value={form.ctc_period}
                onChange={(e) => setForm({ ...form, ctc_period: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
              >
                {PERIODS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Original CTC Text</label>
            <input
              value={form.ctc_raw}
              onChange={(e) => setForm({ ...form, ctc_raw: e.target.value })}
              placeholder="e.g. $120,000 per year"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[13px] font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 transition-all"
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
