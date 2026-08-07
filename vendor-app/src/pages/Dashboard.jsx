import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ScrollText, FileCheck, Receipt, AlertCircle, CheckCircle2, Clock, DollarSign, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';

const fmtMoney = (n, currency = 'USD') => {
  const sym = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'AED' ? 'AED ' : '$';
  return `${sym}${Math.round(n || 0).toLocaleString('en-US')}`;
};

const SOW_STATUS = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  submitted_for_finance: { label: 'Awaiting Finance', color: 'bg-amber-50 text-amber-700' },
  finance_approved: { label: 'Finance Approved', color: 'bg-blue-50 text-blue-700' },
  sent_for_signature: { label: 'Awaiting Signature', color: 'bg-violet-50 text-violet-700' },
  signed: { label: 'Signed', color: 'bg-emerald-50 text-emerald-700' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500' },
};

const INV_STATUS = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  void: 'bg-slate-50 text-slate-400',
};

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/dashboard')
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const totals = data?.invoice_totals || { total: 0, paid: 0, outstanding: 0 };

  const subroleLabel = user?.client_subrole === 'finance' ? 'Finance' : user?.client_subrole === 'manager' ? 'Manager' : 'Stakeholder';

  if (loading && !data) {
    return (
      <>
        <PageHeader icon={LayoutDashboard} title="Client Portal" subtitle="Loading…" />
        <div className="bg-white border border-slate-200/70 rounded-2xl p-12 text-center text-[13px] text-slate-400">Fetching SOWs, invoices, and approvals…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Client Portal"
        subtitle={`Welcome ${user?.name?.split(' ')[0] || ''} · ${subroleLabel} at ${data?.client?.name || 'your organization'}`}
      />

      {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">{error}</div>}

      {/* Pending actions banner */}
      {data?.pending_actions?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-700" strokeWidth={2.2} />
            <h3 className="text-[14px] font-bold text-amber-900">Awaiting your action ({data.pending_actions.length})</h3>
          </div>
          <div className="space-y-2">
            {data.pending_actions.slice(0, 6).map((a, i) => {
              const target = a.kind.startsWith('sow_') ? '/sows'
                : a.kind === 'timesheet_approve' ? '/timesheets'
                : '/invoices';
              return (
                <Link key={i} to={target} className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 hover:bg-white border border-amber-200/40 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      {a.kind.startsWith('sow_') ? <ScrollText size={14} className="text-amber-700" />
                        : a.kind === 'timesheet_approve' ? <FileCheck size={14} className="text-amber-700" />
                        : <Receipt size={14} className="text-amber-700" />}
                    </div>
                    <span className="text-[12px] font-medium text-slate-800">{a.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.value && <span className="text-[12px] font-semibold text-slate-700">{fmtMoney(a.value)}</span>}
                    <span className="text-[11px] text-amber-700/70 group-hover:text-amber-800 transition-colors">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ScrollText size={12} className="text-slate-500" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Active SOWs</span>
          </div>
          <p className="text-[24px] font-bold text-slate-900 tracking-[-0.02em]">{(data?.sow_status_counts?.active || 0) + (data?.sow_status_counts?.signed || 0)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{data?.sows?.length || 0} total in portal</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Receipt size={12} className="text-blue-600" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Invoiced</span>
          </div>
          <p className="text-[20px] font-bold text-slate-900 tabular-nums tracking-[-0.02em]">{fmtMoney(totals.total)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{data?.invoices?.length || 0} invoices</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-emerald-50/40 border border-emerald-200/40 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 size={12} className="text-emerald-600" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Paid</span>
          </div>
          <p className="text-[20px] font-bold text-emerald-800 tabular-nums tracking-[-0.02em]">{fmtMoney(totals.paid)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-amber-50/40 border border-amber-200/40 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={12} className="text-amber-600" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Outstanding</span>
          </div>
          <p className="text-[20px] font-bold text-amber-800 tabular-nums tracking-[-0.02em]">{fmtMoney(totals.outstanding)}</p>
        </motion.div>
      </div>

      {/* Vendor network — promoted hero block */}
      {(data?.vendors?.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden mb-6 rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-600 to-blue-700 text-white shadow-xl shadow-sky-900/20"
        >
          <div className="absolute top-0 right-0 w-[420px] h-[260px] bg-gradient-to-br from-white/15 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-10 w-[300px] h-[200px] bg-cyan-300/10 blur-3xl pointer-events-none" />

          <div className="relative px-6 py-5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Building2 size={18} strokeWidth={2} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Vendor network</p>
                <h3 className="text-[18px] font-bold tracking-[-0.02em]">{data.vendors.length} vendor{data.vendors.length !== 1 ? 's' : ''} engaged on your account</h3>
              </div>
            </div>
            <Link to="/vendors" className="text-[12px] font-semibold text-white/90 hover:text-white inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur transition-colors">
              Manage vendors →
            </Link>
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
            {data.vendors.map(v => (
              <Link
                key={v.id}
                to="/roster"
                className="group relative p-5 bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:from-white/[0.15] hover:to-white/[0.05] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[15px] font-bold text-white">{v.name}</p>
                    <p className="text-[10px] text-white/50 mt-0.5 truncate">{v.category || 'Partner'}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${v.status === 'active' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/40'}`}>
                    {v.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Headcount</p>
                    <p className="text-[22px] font-bold tabular-nums">{v.headcount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Projects</p>
                    <p className="text-[22px] font-bold tabular-nums">{v.projects_count}</p>
                  </div>
                </div>
                <span className="absolute bottom-3 right-4 text-[11px] text-white/40 group-hover:text-white/80 transition-colors">View roster →</span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* SOWs + Billing Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={14} className="text-slate-500" strokeWidth={2} />
              <h3 className="text-[14px] font-semibold text-slate-800">SOWs & Quotes</h3>
            </div>
            <Link to="/sows" className="text-[11px] font-semibold text-amber-700 hover:text-amber-800">View all →</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.sows || []).slice(0, 6).map(s => {
              const ss = SOW_STATUS[s.status] || SOW_STATUS.draft;
              return (
                <Link key={s.id} to="/sows" className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                  <div className="min-w-0">
                    <p className="text-[12px] font-mono text-slate-500">{s.sow_number}</p>
                    <p className="text-[13px] font-medium text-slate-800 truncate">{s.title}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {s.contract_value > 0 && <span className="text-[12px] font-semibold text-slate-700 tabular-nums">{fmtMoney(s.contract_value, s.currency)}</span>}
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${ss.color}`}>{ss.label}</span>
                  </div>
                </Link>
              );
            })}
            {(data?.sows || []).length === 0 && <div className="px-5 py-8 text-center text-[12px] text-slate-400">No SOWs in your portal yet.</div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <DollarSign size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">Resource Billing Rates (SOW)</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {(data?.billing_rates || []).map(r => (
              <div key={r.employee_id || r.project} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-[12px] font-medium text-slate-800 truncate">{r.employee_name || r.project}</p>
                  <p className="text-[10px] text-slate-400">{r.project}</p>
                </div>
                <span className="text-[12px] font-semibold text-emerald-700 tabular-nums">${r.rate}/hr</span>
              </div>
            ))}
            {(data?.billing_rates || []).length === 0 && <div className="px-5 py-8 text-center text-[12px] text-slate-400">No SOW rates configured.</div>}
          </div>
        </motion.div>
      </div>

      {/* Recent invoices */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={14} className="text-slate-500" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-slate-800">Recent Invoices</h3>
          </div>
          <Link to="/invoices" className="text-[11px] font-semibold text-amber-700 hover:text-amber-800">View all →</Link>
        </div>
        {(data?.invoices || []).length === 0 ? (
          <div className="px-5 py-12 text-center text-[12px] text-slate-400">No invoices yet.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/40 border-b border-slate-100">
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Invoice #</th>
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Period</th>
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Issued</th>
                <th className="text-right font-semibold text-slate-500 px-4 py-2">Total</th>
                <th className="text-left font-semibold text-slate-500 px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.slice(0, 6).map(inv => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-slate-700">{inv.invoice_number}</td>
                  <td className="px-4 py-2 text-slate-500">{inv.period_start} → {inv.period_end}</td>
                  <td className="px-4 py-2 text-slate-500">{inv.issue_date || '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmtMoney(inv.total_amount, inv.currency)}</td>
                  <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${INV_STATUS[inv.status] || INV_STATUS.draft}`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </>
  );
}
