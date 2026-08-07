import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Search, CheckCircle2, FileSignature, XCircle, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const fmtMoney = (n, c = 'USD') => {
  const sym = c === 'INR' ? '₹' : c === 'EUR' ? '€' : c === 'AED' ? 'AED ' : '$';
  return `${sym}${Math.round(n || 0).toLocaleString('en-US')}`;
};

const SOW_STATUS = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
  submitted_for_finance: { label: 'Awaiting Finance', color: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  finance_approved: { label: 'Finance Approved', color: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  sent_for_signature: { label: 'Awaiting Signature', color: 'bg-violet-50 text-violet-700 ring-violet-600/10' },
  signed: { label: 'Signed', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 ring-emerald-700/10' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 ring-red-600/10' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-50 text-slate-400 ring-slate-300/10' },
};

export default function ClientSOWs() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [pendingSigOnly, setPendingSigOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectMode, setRejectMode] = useState(false);

  const isFinance = user?.client_subrole === 'finance';
  const isManager = user?.client_subrole === 'manager';

  const [vendors, setVendors] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/sows').catch(() => ({ sows: [] })),
      api.get('/vendors').catch(() => ({ vendors: [] })),
    ])
      .then(([sowRes, vendorRes]) => {
        setRows(sowRes.sows || []);
        setVendors(vendorRes.vendors || []);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(s => !statusFilter || s.status === statusFilter)
      .filter(s => !vendorFilter || s.vendor_name === vendorFilter)
      .filter(s => !pendingSigOnly || s.status === 'sent_for_signature')
      .filter(s => !q
        || s.sow_number.toLowerCase().includes(q)
        || s.title.toLowerCase().includes(q)
        || (s.vendor_name || '').toLowerCase().includes(q));
  }, [rows, search, statusFilter, vendorFilter, pendingSigOnly]);

  const pendingSigCount = useMemo(
    () => rows.filter(s => s.status === 'sent_for_signature').length,
    [rows]
  );

  const runAction = async (path, label) => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(path, { user_id: user?.id });
      setSelected(null);
      load();
    } catch (e) {
      setError(e?.message || `${label} failed`);
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) { setError('Reason required'); return; }
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/sows/${selected.id}/reject`, { reason: rejectReason, user_id: user?.id });
      setSelected(null);
      setRejectMode(false);
      setRejectReason('');
      load();
    } catch (e) {
      setError(e?.message || 'Reject failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={ScrollText}
        title="SOWs & Quotes"
        subtitle={isFinance ? 'Approve SOWs from the delivery team to advance them to DocuSign' : isManager ? 'Approve and sign SOWs for your team' : 'Track all Statements of Work for your account'}
      />

      <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SOW #, title, vendor…" className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-sky-500" />
        </div>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]">
          <option value="">All vendors</option>
          {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]">
          <option value="">All statuses</option>
          {Object.entries(SOW_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setPendingSigOnly(v => !v)}
          className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[12px] font-semibold transition-all ${
            pendingSigOnly
              ? 'bg-violet-50 border-2 border-violet-300 text-violet-700'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileSignature size={13} strokeWidth={2.2} />
          Pending signatures
          {pendingSigCount > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${pendingSigOnly ? 'bg-violet-200 text-violet-800' : 'bg-slate-100 text-slate-600'}`}>
              {pendingSigCount}
            </span>
          )}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading SOWs…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ScrollText} title="No SOWs match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">SOW #</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Title</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Vendor</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Type</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Period</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Value</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const ss = SOW_STATUS[s.status] || SOW_STATUS.draft;
                  return (
                    <tr key={s.id} onClick={() => setSelected(s)} className="border-b border-slate-100 hover:bg-slate-50/40 cursor-pointer">
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{s.sow_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[260px]" title={s.title}>{s.title}</td>
                      <td className="px-4 py-3 text-[12px]">
                        {s.vendor_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/10">{s.vendor_name}</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize text-[12px]">{s.sow_type}</td>
                      <td className="px-4 py-3 text-slate-500 text-[12px]">{s.start_date || '—'} → {s.end_date || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{fmtMoney(s.contract_value, s.currency)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${ss.color}`}>{ss.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Detail modal */}
      <Modal isOpen={!!selected} onClose={() => { setSelected(null); setRejectMode(false); setError(''); }} title={selected ? `${selected.sow_number} · ${selected.title}` : ''} maxWidth="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

            {/* Status banner */}
            <div className={`rounded-xl p-4 ring-1 ring-inset ${SOW_STATUS[selected.status]?.color}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Current status</p>
              <p className="text-[18px] font-bold mt-0.5">{SOW_STATUS[selected.status]?.label}</p>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contract Value</p>
                <p className="text-[16px] font-bold text-slate-900 tabular-nums mt-0.5">{fmtMoney(selected.contract_value, selected.currency)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Type</p>
                <p className="text-[14px] font-semibold text-slate-800 capitalize mt-0.5">{selected.sow_type}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Start</p>
                <p className="text-[14px] font-semibold text-slate-800 mt-0.5">{selected.start_date || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">End</p>
                <p className="text-[14px] font-semibold text-slate-800 mt-0.5">{selected.end_date || '—'}</p>
              </div>
              {selected.resource_name && (
                <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resource</p>
                  <p className="text-[14px] font-semibold text-slate-800 mt-0.5">{selected.resource_name} <span className="font-normal text-slate-500">· {selected.resource_role} · ${selected.resource_rate}/hr</span></p>
                </div>
              )}
            </div>

            {selected.description && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Description</p>
                <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3">{selected.description}</p>
              </div>
            )}

            {/* Audit trail */}
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="flex items-center gap-3 p-3">
                <FileText size={14} className="text-slate-400" strokeWidth={2} />
                <span className="text-[12px] text-slate-500 flex-1">Created by {selected.creator_name ? `${selected.creator_name} (delivery team)` : 'delivery team'}</span>
                <span className="text-[11px] text-slate-400">{new Date(selected.created_at).toLocaleDateString()}</span>
              </div>
              {selected.finance_approved_at && (
                <div className="flex items-center gap-3 p-3">
                  <CheckCircle2 size={14} className="text-emerald-600" strokeWidth={2} />
                  <span className="text-[12px] text-slate-700 flex-1">Finance approved</span>
                  <span className="text-[11px] text-slate-400">{new Date(selected.finance_approved_at).toLocaleDateString()}</span>
                </div>
              )}
              {selected.docusign_envelope_id && (
                <div className="flex items-center gap-3 p-3">
                  <FileSignature size={14} className="text-violet-600" strokeWidth={2} />
                  <span className="text-[12px] text-slate-700 flex-1">DocuSign · <span className="font-mono text-slate-500">{selected.docusign_envelope_id}</span></span>
                  <span className="text-[11px] text-slate-400 capitalize">{selected.docusign_status}</span>
                </div>
              )}
              {selected.manager_signed_at && (
                <div className="flex items-center gap-3 p-3">
                  <CheckCircle2 size={14} className="text-emerald-600" strokeWidth={2} />
                  <span className="text-[12px] text-slate-700 flex-1">Manager signed</span>
                  <span className="text-[11px] text-slate-400">{new Date(selected.manager_signed_at).toLocaleDateString()}</span>
                </div>
              )}
              {selected.rejected_at && (
                <div className="flex items-center gap-3 p-3 bg-red-50/40">
                  <XCircle size={14} className="text-red-600" strokeWidth={2} />
                  <div className="flex-1">
                    <span className="text-[12px] text-red-800">Rejected</span>
                    {selected.rejection_reason && <p className="text-[11px] text-red-600 mt-0.5">{selected.rejection_reason}</p>}
                  </div>
                  <span className="text-[11px] text-red-400">{new Date(selected.rejected_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {rejectMode ? (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Reason for rejection</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} className="w-full p-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-red-500" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setRejectMode(false); setRejectReason(''); }} className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={reject} disabled={actionLoading} className="h-9 px-4 rounded-lg bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 disabled:opacity-60">{actionLoading ? '…' : 'Confirm Reject'}</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button onClick={() => { setSelected(null); setError(''); }} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                <div className="flex items-center gap-2">
                  {/* Finance & client manager can approve their team's SOW when submitted_for_finance */}
                  {(isFinance || isManager) && selected.status === 'submitted_for_finance' && (
                    <>
                      <button onClick={() => setRejectMode(true)} className="h-10 px-4 rounded-xl border border-red-200 text-red-700 text-[13px] font-semibold hover:bg-red-50">Reject</button>
                      <button onClick={() => runAction(`/sows/${selected.id}/finance-approve`, 'Approve')} disabled={actionLoading} className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[13px] font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60 inline-flex items-center gap-2">
                        <CheckCircle2 size={14} strokeWidth={2.2} />
                        Approve SOW
                      </button>
                    </>
                  )}
                  {/* Manager signs when sent_for_signature */}
                  {isManager && selected.status === 'sent_for_signature' && (
                    <>
                      <button onClick={() => setRejectMode(true)} className="h-10 px-4 rounded-xl border border-red-200 text-red-700 text-[13px] font-semibold hover:bg-red-50">Decline</button>
                      <button onClick={() => runAction(`/sows/${selected.id}/sign`, 'Sign')} disabled={actionLoading} className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[13px] font-semibold shadow-lg shadow-violet-600/25 hover:from-violet-600 hover:to-purple-700 disabled:opacity-60 inline-flex items-center gap-2">
                        <FileSignature size={14} strokeWidth={2.2} />
                        Sign via DocuSign
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
