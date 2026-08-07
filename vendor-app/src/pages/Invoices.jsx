import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Receipt, CheckCircle2, DollarSign } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const fmtMoney = (n, c = 'USD') => {
  const sym = c === 'INR' ? '₹' : c === 'EUR' ? '€' : c === 'AED' ? 'AED ' : '$';
  return `${sym}${Math.round(n || 0).toLocaleString('en-US')}`;
};

const STATUS = {
  draft: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  sent: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  overdue: 'bg-red-50 text-red-700 ring-red-600/10',
  void: 'bg-slate-50 text-slate-400 ring-slate-300/10',
};

export default function ClientInvoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentForm, setPaymentForm] = useState({ remittance_ref: '', receipt_url: '' });

  const isFinance = user?.client_subrole === 'finance';
  const isManager = user?.client_subrole === 'manager';

  const load = useCallback(() => {
    setLoading(true);
    api.get('/invoices')
      .then(d => setRows(d.invoices || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => rows.reduce((acc, i) => {
    const a = Number(i.total_amount) || 0;
    acc.total += a;
    if (i.status === 'paid') acc.paid += a;
    else if (i.status !== 'void') acc.outstanding += a;
    return acc;
  }, { total: 0, paid: 0, outstanding: 0 }), [rows]);

  const managerApprove = async () => {
    setActionLoading(true); setError('');
    try {
      await api.post(`/invoices/${selected.id}/manager-approve`);
      setSelected(null); load();
    } catch (e) { setError(e?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const recordPayment = async () => {
    if (!paymentForm.remittance_ref.trim()) { setError('Remittance reference required'); return; }
    setActionLoading(true); setError('');
    try {
      await api.post(`/invoices/${selected.id}/record-payment`, paymentForm);
      setSelected(null); setPaymentForm({ remittance_ref: '', receipt_url: '' }); load();
    } catch (e) { setError(e?.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  return (
    <>
      <PageHeader
        icon={Receipt}
        title="Invoices"
        subtitle={isFinance ? 'Review approved invoices and record payments' : isManager ? 'Approve invoices for payment processing' : 'Track all invoices issued to your account'}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Invoiced</p>
          <p className="text-[22px] font-bold text-slate-900 tabular-nums tracking-[-0.02em] mt-1">{fmtMoney(totals.total)}</p>
        </div>
        <div className="bg-emerald-50/40 border border-emerald-200/40 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Paid</p>
          <p className="text-[22px] font-bold text-emerald-800 tabular-nums tracking-[-0.02em] mt-1">{fmtMoney(totals.paid)}</p>
        </div>
        <div className="bg-amber-50/40 border border-amber-200/40 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Outstanding</p>
          <p className="text-[22px] font-bold text-amber-800 tabular-nums tracking-[-0.02em] mt-1">{fmtMoney(totals.outstanding)}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading invoices…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Invoice #</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Period</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Issued</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Due</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Mgr Approval</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(inv => (
                  <tr key={inv.id} onClick={() => setSelected(inv)} className="border-b border-slate-100 hover:bg-slate-50/40 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{inv.period_start} → {inv.period_end}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{inv.issue_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{inv.due_date || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{fmtMoney(inv.total_amount, inv.currency)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${STATUS[inv.status] || STATUS.draft}`}>{inv.status}</span></td>
                    <td className="px-4 py-3 text-[11px]">
                      {inv.client_manager_approved_at ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={10} strokeWidth={2.5} />Approved</span>
                      ) : <span className="text-slate-400">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal isOpen={!!selected} onClose={() => { setSelected(null); setError(''); }} title={selected ? selected.invoice_number : ''} maxWidth="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

            <div className="grid grid-cols-3 gap-3 text-[12px]">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Period</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selected.period_start} → {selected.period_end}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Total</p>
                <p className="text-[16px] font-bold text-slate-900 tabular-nums mt-0.5">{fmtMoney(selected.total_amount, selected.currency)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Due</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selected.due_date || '—'}</p>
              </div>
            </div>

            {(selected.lines || []).length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-200">
                      <th className="text-left font-semibold text-slate-500 px-3 py-2">Project</th>
                      <th className="text-right font-semibold text-slate-500 px-3 py-2">Hours</th>
                      <th className="text-right font-semibold text-slate-500 px-3 py-2">Rate</th>
                      <th className="text-right font-semibold text-slate-500 px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((l, i) => (
                      <tr key={l.id || i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-700">{l.project_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{l.hours}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">${l.rate}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{fmtMoney(l.amount, selected.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selected.payment_remittance_ref && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[12px]">
                <p className="font-semibold text-emerald-800">Payment recorded</p>
                <p className="text-emerald-700 mt-1">Remittance ref: <span className="font-mono">{selected.payment_remittance_ref}</span></p>
                {selected.payment_receipt_url && <p className="text-emerald-700 mt-0.5">Receipt: <a href={selected.payment_receipt_url} className="underline" target="_blank" rel="noreferrer">{selected.payment_receipt_url}</a></p>}
              </div>
            )}

            {/* Actions */}
            {isManager && !selected.client_manager_approved_at && selected.status !== 'paid' && selected.status !== 'void' && (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setSelected(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                <button onClick={managerApprove} disabled={actionLoading} className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[13px] font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60 inline-flex items-center gap-2">
                  <CheckCircle2 size={14} strokeWidth={2.2} /> Approve invoice
                </button>
              </div>
            )}

            {isFinance && selected.status !== 'paid' && selected.status !== 'void' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Record payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Remittance ref *</label>
                    <input value={paymentForm.remittance_ref} onChange={e => setPaymentForm({ ...paymentForm, remittance_ref: e.target.value })} placeholder="WIRE-2026-XXXX" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Receipt URL</label>
                    <input value={paymentForm.receipt_url} onChange={e => setPaymentForm({ ...paymentForm, receipt_url: e.target.value })} placeholder="https://…" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setSelected(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                  <button onClick={recordPayment} disabled={actionLoading} className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[13px] font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60 inline-flex items-center gap-2">
                    <DollarSign size={14} strokeWidth={2.2} /> Mark Paid
                  </button>
                </div>
              </div>
            )}

            {!isManager && !isFinance && (
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button onClick={() => setSelected(null)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Close</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
