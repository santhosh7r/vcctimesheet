import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Plus, Search, Pencil, Trash2, Upload, FileText, ExternalLink, Download } from 'lucide-react';
import { api, supabase, getFileUrl } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const STATUS = [
  { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
  { value: 'sent', label: 'Sent', color: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  { value: 'paid', label: 'Paid', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-50 text-red-700 ring-red-600/10' },
  { value: 'void', label: 'Void', color: 'bg-slate-50 text-slate-400 ring-slate-300/10' },
];
const statusStyle = (s) => STATUS.find(x => x.value === s) || STATUS[0];

const fmtCurrency = (n, c = 'USD') => {
  const sym = c === 'INR' ? '₹' : c === 'EUR' ? '€' : c === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export default function FinanceInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/invoices'), api.get('/clients')])
      .then(([i, c]) => { setInvoices(i.invoices || []); setClients(c.clients || []); })
      .catch(() => { setInvoices([]); setClients([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientName = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter(i => !statusFilter || i.status === statusFilter)
      .filter(i => !q || i.invoice_number.toLowerCase().includes(q) || (clientName[i.client_id] || '').toLowerCase().includes(q));
  }, [invoices, search, statusFilter, clientName]);

  const totals = useMemo(() => {
    const acc = { count: filtered.length, totalAmount: 0, paidAmount: 0, outstandingAmount: 0 };
    for (const i of filtered) {
      const a = Number(i.total_amount) || 0;
      acc.totalAmount += a;
      if (i.status === 'paid') acc.paidAmount += a;
      else if (i.status !== 'void') acc.outstandingAmount += a;
    }
    return acc;
  }, [filtered]);

  const open = (inv) => {
    if (inv) {
      setEditingId(inv.id);
      setForm({
        invoice_number: inv.invoice_number,
        client_id: inv.client_id,
        period_start: inv.period_start,
        period_end: inv.period_end,
        due_date: inv.due_date || '',
        total_amount: inv.total_amount || 0,
        currency: inv.currency || 'USD',
        status: inv.status,
        notes: inv.notes || '',
        file_url: inv.file_url || '',
        file_name: inv.file_name || '',
      });
    } else {
      setEditingId(null);
      const start = addDays(todayIso(), -14);
      setForm({
        invoice_number: '',
        client_id: clients[0]?.id || '',
        period_start: start, period_end: todayIso(),
        due_date: addDays(todayIso(), 30),
        total_amount: 0,
        currency: 'USD', status: 'draft', notes: '',
        file_url: '', file_name: '',
      });
    }
    setError('');
    setModalOpen(true);
  };

  // Open an uploaded invoice via a signed URL (bucket is private).
  const openFile = async (stored) => {
    if (!stored) return;
    const url = await getFileUrl(stored);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File too large. Maximum 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop();
      const fileName = `invoice_${Date.now()}.${ext}`;
      const path = `invoices/${fileName}`;

      if (supabase) {
        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
        if (uploadErr) throw new Error(uploadErr.message);
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        setForm(f => ({ ...f, file_url: urlData.publicUrl, file_name: file.name }));
      } else {
        // Fallback: store as data URL for demo
        const reader = new FileReader();
        reader.onload = () => {
          setForm(f => ({ ...f, file_url: reader.result, file_name: file.name }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      setError('File upload failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.client_id) { setError('Client required'); return; }
    if (!form.period_start || !form.period_end) { setError('Period required'); return; }
    if (!form.total_amount || Number(form.total_amount) <= 0) { setError('Invoice value required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        invoice_number: form.invoice_number,
        client_id: form.client_id,
        period_start: form.period_start,
        period_end: form.period_end,
        issue_date: todayIso(),
        due_date: form.due_date,
        currency: form.currency,
        total_amount: Number(form.total_amount),
        subtotal: Number(form.total_amount),
        status: form.status,
        notes: form.notes,
        file_url: form.file_url || null,
        file_name: form.file_name || null,
      };
      if (editingId) await api.put(`/invoices/${editingId}`, payload);
      else await api.post('/invoices', payload);
      setModalOpen(false); load();
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    await api.del(`/invoices/${inv.id}`).catch(() => {});
    load();
  };

  const markPaid = async (inv) => {
    await api.put(`/invoices/${inv.id}`, { status: 'paid' });
    load();
  };

  const inputClass = "w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500";

  return (
    <>
      <PageHeader
        icon={Receipt}
        title="Invoices"
        subtitle="Upload and track client invoices"
        actions={
          <button onClick={() => open(null)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700">
            <Plus size={16} strokeWidth={2.2} />
            New Invoice
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Invoices</p>
          <p className="text-[24px] font-bold text-slate-900 mt-1 tracking-[-0.02em]">{totals.count}</p>
        </div>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Billed</p>
          <p className="text-[20px] font-bold text-slate-900 mt-1 tabular-nums tracking-[-0.02em]">{fmtCurrency(totals.totalAmount)}</p>
        </div>
        <div className="bg-emerald-50/40 border border-emerald-200/50 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Paid</p>
          <p className="text-[20px] font-bold text-emerald-800 mt-1 tabular-nums tracking-[-0.02em]">{fmtCurrency(totals.paidAmount)}</p>
        </div>
        <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Outstanding</p>
          <p className="text-[20px] font-bold text-amber-800 mt-1 tabular-nums tracking-[-0.02em]">{fmtCurrency(totals.outstandingAmount)}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice # or client" className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-amber-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]">
          <option value="">All statuses</option>
          {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading invoices…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" description="Upload your first invoice with period, due date, value, and supporting document." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Invoice #</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Client</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Period</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Due</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Value</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">File</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const ss = statusStyle(inv.status);
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/40 group">
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{inv.invoice_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{clientName[inv.client_id] || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-[12px]">{inv.period_start} → {inv.period_end}</td>
                      <td className="px-4 py-3 text-slate-500 text-[12px]">{inv.due_date || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtCurrency(inv.total_amount, inv.currency)}</td>
                      <td className="px-4 py-3 text-center">
                        {inv.file_url ? (
                          <button type="button" onClick={() => openFile(inv.file_url)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100 transition-colors"
                            title={inv.file_name || 'View file'}>
                            <FileText size={12} />
                            {inv.file_name ? inv.file_name.slice(0, 20) + (inv.file_name.length > 20 ? '…' : '') : 'View'}
                            <ExternalLink size={10} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${ss.color}`}>{ss.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {inv.status !== 'paid' && (
                            <button onClick={() => markPaid(inv)} title="Mark paid" className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-all">Paid</button>
                          )}
                          <button onClick={() => open(inv)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50"><Pencil size={14} strokeWidth={1.8} /></button>
                          <button onClick={() => remove(inv)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} strokeWidth={1.8} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? `Edit ${form?.invoice_number}` : 'New Invoice'} maxWidth="max-w-2xl">
        {form && (
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Invoice #</label>
                <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="e.g. INV-2026-001" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client *</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={inputClass}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Period Start *</label>
                <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Period End *</label>
                <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Due Date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Invoice Value *</label>
                <input type="number" min="0" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass}>
                  <option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option><option value="AED">AED</option>
                </select>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Attachment (PDF, Excel, Word, etc.)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-amber-400 transition-colors">
                {form.file_url ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span className="text-[13px] font-medium text-slate-700">{form.file_name || 'Uploaded file'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openFile(form.file_url)}
                        className="text-[12px] font-semibold text-blue-600 hover:text-blue-800">View</button>
                      <button type="button" onClick={() => setForm({ ...form, file_url: '', file_name: '' })}
                        className="text-[12px] font-semibold text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload size={20} className="text-slate-400 mb-1" />
                    <span className="text-[12px] text-slate-500">
                      {uploading ? 'Uploading...' : 'Click to upload or drag file here'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PDF, Excel, Word, Images — max 10MB</span>
                    <input type="file" className="hidden"
                      accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.png,.jpg,.jpeg"
                      onChange={handleFileUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Notes</label>
                <input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" className={inputClass} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60">
                {saving ? 'Saving…' : editingId ? 'Save Invoice' : 'Create Invoice'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
