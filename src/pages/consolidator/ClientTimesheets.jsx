import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Plus, Trash2, Send, Building2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const WORKFORCE_ROLES = ['employee', 'consultant', 'manager'];

const STATUS_TONE = {
  submitted: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  saved: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-50 text-red-700',
};

const emptyEntry = () => ({ date: '', hours: '', work_item: '' });

const emptyForm = () => ({
  userId: '',
  project: '',
  periodLabel: '',
  status: 'submitted',
  entries: [emptyEntry()],
});

export default function ClientTimesheets() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Clients + workforce load once
  useEffect(() => {
    api.get('/clients').then(d => setClients(d.clients || [])).catch(() => setClients([]));
    api.get('/users?include_all=true')
      .then(d => setEmployees((d.users || []).filter(u => WORKFORCE_ROLES.includes(u.role) && u.is_active)))
      .catch(() => setEmployees([]));
  }, []);

  const projectNames = useMemo(() => new Set(projects.map(p => p.name)), [projects]);

  const loadClientData = useCallback((cid) => {
    if (!cid) { setProjects([]); setTimesheets([]); return; }
    setLoading(true);
    Promise.all([
      api.get(`/billable-projects?client_id=${cid}`).catch(() => ({ projects: [] })),
      api.get('/timesheets/all').catch(() => ({ timesheets: [] })),
    ])
      .then(([proj, ts]) => {
        const names = new Set((proj.projects || []).map(p => p.name));
        setProjects(proj.projects || []);
        setTimesheets((ts.timesheets || []).filter(t => names.has(t.user_project)));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadClientData(clientId); }, [clientId, loadClientData]);

  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) || null, [clients, clientId]);

  // Timesheets the client manager has signed off — these are the ones D4 finance
  // can roll into an invoice (the "reflect to D4 finance" step of the chain).
  const readyToInvoice = useMemo(
    () => timesheets.filter(t => t.client_approval_status === 'approved'),
    [timesheets]
  );

  const openCreate = () => {
    if (!clientId) { setError('Select a client first'); return; }
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const updateEntry = (idx, field, value) => {
    setForm(f => {
      const entries = [...f.entries];
      entries[idx] = { ...entries[idx], [field]: value };
      return { ...f, entries };
    });
  };
  const addEntryRow = () => setForm(f => ({ ...f, entries: [...f.entries, emptyEntry()] }));
  const removeEntryRow = (idx) => setForm(f => ({ ...f, entries: f.entries.filter((_, i) => i !== idx) }));

  const formTotal = useMemo(
    () => form.entries.reduce((s, e) => s + (Number(e.hours) || 0), 0),
    [form.entries]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.userId) { setError('Select a resource'); return; }
    if (!form.project) { setError('Select the client project this timesheet bills to'); return; }
    if (!form.periodLabel.trim()) { setError('Enter a period label (e.g. "Jun 1–15, 2026")'); return; }
    const emp = employees.find(u => u.id === form.userId);
    const entries = form.entries
      .filter(en => en.date && (Number(en.hours) || en.work_item))
      .map(en => ({
        date: en.date,
        day_name: en.date ? new Date(en.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }) : '',
        work_item: en.work_item || '',
        description: '',
        hours: Number(en.hours) || 0,
      }));
    if (entries.length === 0) { setError('Add at least one day with a date and hours'); return; }

    setSaving(true); setError('');
    try {
      await api.post('/timesheets', {
        userId: form.userId,
        userName: emp?.name || '',
        userProject: form.project,
        periodLabel: form.periodLabel.trim(),
        status: form.status,
        entries,
      });
      setModalOpen(false);
      loadClientData(clientId);
    } catch (err) {
      setError(err?.message || 'Failed to add timesheet');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500 transition-all";

  return (
    <>
      <PageHeader
        icon={FileSpreadsheet}
        title="Client Timesheets"
        subtitle="Add timesheets to a client's portal — billed against their projects"
        actions={
          <button
            onClick={openCreate}
            disabled={!clientId}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[13px] font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.2} />
            Add Timesheet
          </button>
        }
      />

      {error && !modalOpen && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">{error}</div>}

      {/* Client selector */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Building2 size={16} strokeWidth={2} />
            <label className="text-[11px] font-semibold uppercase tracking-wider">Client</label>
          </div>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:border-primary-500 min-w-[260px]"
          >
            <option value="">— Select a client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClient && (
            <span className="text-[12px] text-slate-400">{projects.length} billable project{projects.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Reflect to D4 finance: timesheets the client manager has approved are ready to invoice */}
      {clientId && readyToInvoice.length > 0 && (
        <div className="mb-5 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200/70 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
          <p className="text-[12px] text-emerald-800">
            <span className="font-bold">{readyToInvoice.length}</span> timesheet{readyToInvoice.length !== 1 ? 's' : ''} approved by the client manager —
            <span className="font-semibold"> ready to invoice</span> on the Invoices page.
          </p>
        </div>
      )}

      {/* Timesheets table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {!clientId ? (
          <EmptyState icon={Building2} title="Select a client" description="Choose a client above to see and add timesheets that appear in their portal." />
        ) : loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading…</div>
        ) : timesheets.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No timesheets for this client" description="Use “Add Timesheet” to push hours to this client's portal." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Resource</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Project</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Period</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Hours</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Client Sign-off</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map(t => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.user_name}</td>
                    <td className="px-4 py-3 text-slate-600 text-[12px]">{t.user_project || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-[12px]">{t.period_label}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{Math.round(t.total_hours || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${STATUS_TONE[t.status] || STATUS_TONE.submitted}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px]">
                      {t.client_approval_status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 size={11} strokeWidth={2.5} /> Approved</span>
                      ) : t.client_approval_status === 'rejected' ? (
                        <span className="text-red-600 font-semibold">Rejected</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="mt-3 text-[11px] text-slate-400">
        Timesheets added here appear in the client portal (read-only) under the selected project. The resource's project is overridden to bill against the client's engagement.
      </p>

      {/* Add timesheet modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Add Timesheet${selectedClient ? ` — ${selectedClient.name}` : ''}`} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Resource *</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputClass}>
                <option value="">— Select —</option>
                {employees.map(u => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client Project *</label>
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputClass}>
                <option value="">— Select —</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Period Label *</label>
              <input value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} placeholder="e.g. Jun 1–15, 2026" className={inputClass} />
            </div>
          </div>

          {/* Entries editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Daily Entries</label>
              <span className="text-[11px] text-slate-400">Total: <span className="font-semibold text-slate-700 tabular-nums">{formTotal}h</span></span>
            </div>
            <div className="space-y-2">
              {form.entries.map((en, idx) => (
                <div key={idx} className="grid grid-cols-[140px_90px_1fr_auto] gap-2 items-center">
                  <input type="date" value={en.date} onChange={(e) => updateEntry(idx, 'date', e.target.value)} className="h-9 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:border-primary-500" />
                  <input type="number" min="0" max="24" step="0.5" value={en.hours} onChange={(e) => updateEntry(idx, 'hours', e.target.value)} placeholder="Hrs" className="h-9 px-2 rounded-lg border border-slate-200 text-[12px] text-right tabular-nums focus:outline-none focus:border-primary-500" />
                  <input value={en.work_item} onChange={(e) => updateEntry(idx, 'work_item', e.target.value)} placeholder="Work item / project" className="h-9 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:border-primary-500" />
                  <button type="button" onClick={() => removeEntryRow(idx)} disabled={form.entries.length === 1} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addEntryRow} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary-600 hover:text-primary-700">
              <Plus size={13} strokeWidth={2.4} /> Add day
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={`${inputClass} max-w-[200px]`}>
              <option value="submitted">Submitted (visible to client)</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[13px] font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800 disabled:opacity-60 inline-flex items-center gap-2 transition-all">
              <Send size={14} strokeWidth={2.2} />
              {saving ? 'Adding…' : 'Add to Client Portal'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
