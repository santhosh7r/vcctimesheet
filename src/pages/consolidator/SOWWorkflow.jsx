import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Plus, Search, Send, FileSignature, PlayCircle, RefreshCw, X, Paperclip, Eye, ArrowLeft, FileText, Mail, Upload, ExternalLink, Trash2, ArrowUpDown } from 'lucide-react';
import { api, supabase, getFileUrl } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const fmtMoney = (n, c = 'USD') => {
  const sym = c === 'INR' ? '\u20B9' : c === 'EUR' ? '\u20AC' : c === 'AED' ? 'AED ' : '$';
  return `${sym}${Math.round(n || 0).toLocaleString('en-US')}`;
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// Short date for the table (e.g. "12 Jan 2026"); accepts ISO date or timestamp.
const fmtShort = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SOW_STATUS = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
  submitted_for_finance: { label: 'Sent Draft', color: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  changes_requested: { label: 'Changes Requested', color: 'bg-orange-50 text-orange-700 ring-orange-600/10' },
  finance_approved: { label: 'Finance Approved', color: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  sent_for_signature: { label: 'Awaiting Signature', color: 'bg-violet-50 text-violet-700 ring-violet-600/10' },
  signed: { label: 'Signed', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 ring-emerald-700/10' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 ring-red-600/10' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-50 text-slate-400 ring-slate-300/10' },
};

const empty = {
  title: '', client_id: '', project_id: '', sow_type: 'project', description: '',
  contract_value: 0, currency: 'USD', start_date: '', end_date: '',
  resource_name: '', resource_role: '', resource_rate: '', location: 'Offshore',
  quantity: 1, file_url: '', file_name: '',
};

function buildSowHtml(form, clientLabel) {
  const effDate = fmtDate(form.start_date) || fmtDate(new Date().toISOString().slice(0, 10));
  const sowNum = form.sow_number || 'TBD';
  const role = form.resource_role || form.title || 'IT Consultant';
  const rate = form.resource_rate || 0;
  const qty = form.quantity || 1;
  const loc = form.location === 'Onsite' ? 'Houston, TX' : form.location === 'Hybrid' ? 'Hybrid' : 'India';
  const scopeText = form.description || `Vendor will provide professional services for ${form.title}. Specifications for deliverables to be provided by Vendor will be created by the parties during the performance of this Statement of Work. Vendor will perform the Services under the general direction of Client, but Vendor will determine the manner and means by which the Services are accomplished, subject to the requirement that Vendor shall at all times comply with applicable law.`;

  return `<div style="font-family: 'Times New Roman', Georgia, serif; max-width: 720px; margin: 0 auto; color: #1a1a1a; line-height: 1.65; font-size: 13.5px;">

  <h2 style="text-align: center; font-size: 16px; font-weight: bold; margin: 0 0 24px; color: #000;">Statement of Work No. ${sowNum}</h2>

  <p>This Statement of Work, dated as of the Effective Date, is entered into by D4 Technologies, Inc., ("Vendor") and ${clientLabel} ("Client") in accordance with and subject to the terms of that certain Master Services Agreement, dated as of 6th January, 2023, by and between Vendor and Client. Capitalized terms used in this Statement of Work but not defined herein shall have the meanings set forth in the MSA. In the event of any conflict between the terms and provisions of this Statement of Work and the MSA, the MSA shall govern unless this Statement of Work expressly references the provision(s) of the MSA that are intended to be superseded for this Statement of Work.</p>

  <p><strong>Effective Date:</strong> ${effDate}</p>

  <p><strong>Services to be Performed:</strong></p>
  <p>${scopeText}</p>

  <p><strong>Rates and Fees:</strong> All work performed by Vendor will be charged to Client on a time and materials basis. The duration and hours per month identified in the table below only indicate the expected availability of the Vendor resources, not minimum or guaranteed fees to be paid by Client. The following rate table provides the hourly rate for each Vendor resource identified in this Statement of Work:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <thead>
      <tr>
        <th style="padding: 8px 12px; border: 1px solid #333; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; background: #f5f5f5;">Requirements</th>
        <th style="padding: 8px 12px; border: 1px solid #333; text-align: center; font-size: 12px; font-weight: bold; text-transform: uppercase; background: #f5f5f5;">Quantity</th>
        <th style="padding: 8px 12px; border: 1px solid #333; text-align: center; font-size: 12px; font-weight: bold; text-transform: uppercase; background: #f5f5f5;">Hourly Rate</th>
        <th style="padding: 8px 12px; border: 1px solid #333; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; background: #f5f5f5;">Location</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #333; font-size: 13px;">${role}</td>
        <td style="padding: 8px 12px; border: 1px solid #333; text-align: center; font-size: 13px;">${qty}</td>
        <td style="padding: 8px 12px; border: 1px solid #333; text-align: center; font-size: 13px;">$${rate}</td>
        <td style="padding: 8px 12px; border: 1px solid #333; font-size: 13px;">${loc}</td>
      </tr>
    </tbody>
  </table>

  <p>Vendor's office hours are 9:00 AM to 5:30 PM IST. Any services required in overlap with the client morning timing to cover meetings and discussions will be agreed mutually during the performance of this Statement of Work. The Services will be performed based on a standard 40-hour work week, provided that Client may book extra hours over and above 40 per week at the hourly rate.</p>

  <p>Client will be invoiced based on the amount of time actually required to provide the Services. Billable hours are applicable only to equal hours expended. Billing is not applicable for absence due to holidays, illness, emergency leave, or vacation time. Vendor will use its commercially practical efforts to minimize absences over which it may have control. Vendor will submit a monthly invoice to Client for all fees and direct expenses incurred hereunder. Invoices shall be generated from Vendor's standard time record.</p>

  <p>Time records for each Vendor consultant performing work hereunder shall be available to Client upon request. All out-of-pocket travel related expenses must be pre-approved in writing by Client. Travel and related expenses shall be reimbursed at actual cost.</p>

  <p><strong>Reports:</strong> Vendor will provide Client with weekly written progress reports of its performance under this Statement of Work. Progress reports shall cover all work performed during the week and identify the work to be performed during the subsequent week. Progress reports shall identify any problems encountered or still outstanding with an explanation of the cause and resolution of the problem or how it will be resolved. Vendor will conduct weekly status meetings with Client Project Manager.</p>

  <br><br>

  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 40px;">
        <p style="font-weight: bold; margin: 0 0 32px;">${clientLabel}</p>
        <p style="margin: 0 0 4px;">By: &nbsp;&nbsp; ____________________________</p>
        <p style="margin: 0 0 4px;">Name: ____________________________</p>
        <p style="margin: 0 0 0;">Title: &nbsp; ____________________________</p>
      </td>
      <td style="width: 50%; vertical-align: top;">
        <p style="font-weight: bold; margin: 0 0 32px;">D4 Technologies, Inc.</p>
        <p style="margin: 0 0 4px;">By: &nbsp;&nbsp; ____________________________</p>
        <p style="margin: 0 0 4px;">Name: ____________________________</p>
        <p style="margin: 0 0 0;">Title: &nbsp; ____________________________</p>
      </td>
    </tr>
  </table>

</div>`;
}

export default function SOWWorkflow() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // YYYY-MM or '' for all
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState(null); // row-level PDF upload
  const [uploading, setUploading] = useState(false); // form PDF upload
  const [sortDir, setSortDir] = useState('desc'); // sort by created date
  const [deletingId, setDeletingId] = useState(null);

  // New states for document preview + email compose
  const [step, setStep] = useState('form'); // 'form' | 'preview' | 'email'
  const [createdSow, setCreatedSow] = useState(null);
  const [sowHtml, setSowHtml] = useState('');
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [emailTo, setEmailTo] = useState('gayathri.m@d4insight.com');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/sows'), api.get('/clients'), api.get('/billable-projects')])
      .then(([s, c, p]) => { setRows(s.sows || []); setClients(c.clients || []); setProjects(p.projects || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Distinct YYYY-MM keys present in the SOW list, newest first.
  const monthOptions = useMemo(() => {
    const set = new Set();
    for (const s of rows) {
      const d = s.created_at || s.start_date;
      if (!d) continue;
      const dt = new Date(d);
      if (isNaN(dt)) continue;
      set.add(`${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, '0')}`);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows
      .filter(s => !statusFilter || s.status === statusFilter)
      .filter(s => {
        if (!monthFilter) return true;
        const d = s.created_at || s.start_date;
        if (!d) return false;
        const dt = new Date(d);
        if (isNaN(dt)) return false;
        return `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, '0')}` === monthFilter;
      })
      .filter(s => !q || (s.sow_number || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q));
    const ts = (s) => new Date(s.created_at || s.start_date || 0).getTime() || 0;
    return [...list].sort((a, b) => sortDir === 'asc' ? ts(a) - ts(b) : ts(b) - ts(a));
  }, [rows, search, statusFilter, monthFilter, sortDir]);

  // Upload a SOW document (PDF) to the public 'documents' bucket and return its
  // public URL + original name. Falls back to a data URL in mock/demo mode.
  const uploadSowFile = async (file) => {
    if (!file) return null;
    if (file.size > 10 * 1024 * 1024) throw new Error('File too large. Maximum 10MB.');
    const ext = file.name.split('.').pop();
    const path = `sows/sow_${Date.now()}.${ext}`;
    if (supabase) {
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      return { file_url: urlData.publicUrl, file_name: file.name };
    }
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    return { file_url: dataUrl, file_name: file.name };
  };

  // Upload from the New SOW form — stores the URL on the form, saved with the draft.
  const handleFormUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const f = await uploadSowFile(file);
      if (f) setForm(prev => ({ ...prev, file_url: f.file_url, file_name: f.file_name }));
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Attach / replace a PDF directly from the SOW table, mapped to that SOW row.
  const handleRowUpload = async (sow, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingId(sow.id);
    try {
      const f = await uploadSowFile(file);
      if (f) { await api.put(`/sows/${sow.id}`, f); load(); }
    } catch (err) {
      alert(err?.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  // Open an attached SOW document via a signed URL (private bucket).
  const openDoc = async (stored) => {
    if (!stored) return;
    const url = await getFileUrl(stored);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const deleteSow = async (sow) => {
    if (!window.confirm(`Delete SOW ${sow.sow_number}? This cannot be undone.`)) return;
    setDeletingId(sow.id);
    try {
      await api.del(`/sows/${sow.id}`);
      load();
    } catch (err) {
      alert(err?.message || 'Failed to delete SOW');
    } finally {
      setDeletingId(null);
    }
  };

  const openNew = () => {
    setForm({ ...empty, client_id: clients[0]?.id || '' });
    setError('');
    setStep('form');
    setCreatedSow(null);
    setSowHtml('');
    setShowDocPreview(false);
    setModalOpen(true);
  };

  // Step 1: Create draft + generate SOW doc
  const createDraft = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title required'); return; }
    if (!form.client_id) { setError('Client required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        contract_value: Number(form.contract_value) || 0,
        resource_rate: form.resource_rate ? Number(form.resource_rate) : null,
        project_id: form.project_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        file_url: form.file_url || null,
        file_name: form.file_name || null,
        status: 'draft',
      };
      const result = await api.post('/sows', payload);
      const sow = result.sow;
      setCreatedSow(sow);

      // Generate SOW document HTML
      const clientLabel = clientMap[form.client_id] || 'Client';
      const html = buildSowHtml({ ...form, sow_number: sow.sow_number }, clientLabel);
      setSowHtml(html);

      // Prepare email
      setEmailTo('gayathri.m@d4insight.com');
      setEmailSubject(`SOW Approval Required: ${form.title} - ${sow.sow_number}`);
      setEmailBody(`Hi,\n\nPlease review the attached Statement of Work for your approval.\n\nSOW: ${sow.sow_number}\nTitle: ${form.title}\nClient: ${clientLabel}\nValue: ${fmtMoney(form.contract_value, form.currency)}\n\nPlease reply with APPROVED or REJECTED.\n\nRegards,\nD4 Insight`);

      setStep('preview');
      load();
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Send email
  const sendEmail = async () => {
    if (!createdSow) { alert('No SOW selected'); return; }
    if (!emailTo.trim().toLowerCase().endsWith('@d4insight.com')) {
      alert('Only internal @d4insight.com email addresses are allowed. Client emails cannot be sent from sysadmin.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api.post(`/sows/${createdSow.id}/submit-email`, {
        custom_to: emailTo,
        custom_subject: emailSubject,
        custom_body: emailBody,
        sow_html: sowHtml,
      });
      alert('SOW submitted for approval! Email will be sent via the automation system.');
      setModalOpen(false);
      load();
    } catch (err) {
      const msg = err?.message || 'Failed to submit SOW';
      setError(msg);
      alert('Error: ' + msg);
    } finally {
      setSending(false);
    }
  };

  const action = async (id, path) => {
    setActionLoading(id + path);
    try {
      if (path === 'submit') {
        // Open email compose for existing draft
        const sow = rows.find(s => s.id === id);
        if (!sow) throw new Error('SOW not found');
        setCreatedSow({ ...sow, _fromTable: true });
        const clientLabel = clientMap[sow.client_id] || 'Client';
        const html = buildSowHtml({ ...sow, resource_role: sow.resource_role || sow.title, quantity: 1, location: 'Offshore' }, clientLabel);
        setSowHtml(html);
        setEmailTo('gayathri.m@d4insight.com');
        setEmailSubject(`SOW Approval Required: ${sow.title} - ${sow.sow_number}`);
        setEmailBody(`Hi,\n\nPlease review the attached Statement of Work for your approval.\n\nSOW: ${sow.sow_number}\nTitle: ${sow.title}\nClient: ${clientLabel}\nValue: ${fmtMoney(sow.contract_value, sow.currency)}\n\nPlease reply with APPROVED or REJECTED.\n\nRegards,\nD4 Insight`);
        setStep('email');
        setShowDocPreview(false);
        setModalOpen(true);
        setActionLoading(null);
        return;
      }
      if (path === 'check-docusign') {
        const result = await api.get(`/sows/${id}`);
        const sow = result.sow || result;
        if (sow.docusign_status === 'completed') {
          alert('Signature completed! SOW is now marked as signed.');
        } else {
          alert(`DocuSign status: ${sow.docusign_status || 'not sent'}\nEnvelope: ${sow.docusign_envelope_id || 'N/A'}`);
        }
        load();
        setActionLoading(null);
        return;
      }
      if (path === 'send-for-signature') {
        const email = prompt('Enter client manager email for DocuSign:');
        if (!email) { setActionLoading(null); return; }
        const name = prompt('Enter signer name (optional):') || '';
        const resp = await fetch('/api/sow/send-docusign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sow_id: id, signer_email: email, signer_name: name }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'DocuSign failed');
        if (result.config_needed) {
          alert(`SOW marked for signature. DocuSign credentials pending.\nPlaceholder ID: ${result.envelope_id}`);
        } else if (result.envelope_id) {
          alert(`DocuSign envelope sent to ${email}.\nEnvelope ID: ${result.envelope_id}`);
        }
      } else if (path === 'review-changes') {
        // Open the changes requested view with editable fields
        const sow = rows.find(s => s.id === id);
        if (!sow) throw new Error('SOW not found');
        setCreatedSow({ ...sow, _fromTable: true });
        setForm({
          ...empty,
          title: sow.title || '',
          client_id: sow.client_id || '',
          contract_value: sow.contract_value || 0,
          currency: sow.currency || 'USD',
          resource_role: sow.resource_role || '',
          resource_rate: sow.resource_rate || '',
          resource_name: sow.resource_name || '',
          location: sow.location || 'Offshore',
          description: sow.description || '',
          start_date: sow.start_date || '',
          end_date: sow.end_date || '',
          sow_type: sow.sow_type || 'project',
          quantity: sow.quantity || 1,
        });
        setError('');
        setStep('changes');
        setModalOpen(true);
        setActionLoading(null);
        return;
      } else if (path === 'resend') {
        // Reset to draft so it can be re-sent
        await api.put(`/sows/${id}`, { status: 'draft' });
        // Then open email compose
        const sow = rows.find(s => s.id === id);
        if (sow) {
          sow.status = 'draft';
          setCreatedSow({ ...sow, _fromTable: true });
          const clientLabel = clientMap[sow.client_id] || 'Client';
          const html = buildSowHtml({ ...sow, resource_role: sow.resource_role || sow.title, quantity: 1, location: sow.location || 'Offshore' }, clientLabel);
          setSowHtml(html);
          setEmailTo('gayathri.m@d4insight.com');
          setEmailSubject(`SOW Revised - Approval Required: ${sow.title} - ${sow.sow_number}`);
          setEmailBody(`Hi,\n\nPlease review the revised Statement of Work.\n\nSOW: ${sow.sow_number}\nTitle: ${sow.title}\nClient: ${clientLabel}\nValue: ${fmtMoney(sow.contract_value, sow.currency)}\n\nThe requested changes have been incorporated. Please reply with APPROVED or REJECTED.\n\nRegards,\nD4 Insight`);
          setStep('email');
          setShowDocPreview(false);
          setModalOpen(true);
        }
        load();
        setActionLoading(null);
        return;
      } else {
        const result = await api.post(`/sows/${id}/${path}`);
        if (path === 'check-approval' && result.status) {
          if (result.status === 'finance_approved') alert(`Approved! ${result.notes || ''}`);
          else if (result.status === 'rejected') alert(`Rejected: ${result.reason || 'No reason given'}`);
          else if (result.status === 'changes_requested') alert(`Changes requested! Click "Review Changes" to see the feedback.`);
          else alert(result.message || 'No response yet');
        }
      }
      load();
    } catch (err) {
      alert(err?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const inputClass = 'w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500';

  return (
    <>
      <PageHeader
        icon={ScrollText}
        title="SOW Manager"
        subtitle="Create SOWs, generate documents, and route through finance approval and DocuSign"
        actions={
          <button onClick={openNew} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700">
            <Plus size={16} strokeWidth={2.2} /> New SOW
          </button>
        }
      />

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SOW # or title" className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-amber-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]">
          <option value="">All statuses</option>
          {Object.entries(SOW_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px]" title="Filter by created month">
          <option value="">All months</option>
          {monthOptions.map(key => {
            const [y, m] = key.split('-');
            return <option key={key} value={key}>{MONTHS_SHORT[Number(m)]} {y}</option>;
          })}
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading SOWs...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ScrollText} title="No SOWs match filters" description="Create the first SOW to start the workflow." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">SOW #</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Title</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Client</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Type</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Value</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">Document</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">
                    <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="inline-flex items-center gap-1 hover:text-slate-900" title="Sort by date">
                      Created <ArrowUpDown size={12} className="text-slate-400" />
                    </button>
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const ss = SOW_STATUS[s.status] || SOW_STATUS.draft;
                  const busy = (k) => actionLoading === s.id + k;
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{s.sow_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[260px]" title={s.title}>{s.title}</td>
                      <td className="px-4 py-3 text-slate-600 text-[12px]">{clientMap[s.client_id] || s.client_id}</td>
                      <td className="px-4 py-3 text-slate-500 text-[12px] capitalize">{s.sow_type}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{fmtMoney(s.contract_value, s.currency)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {s.file_url && (
                            <button type="button" onClick={() => openDoc(s.file_url)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100 transition-colors"
                              title={s.file_name || 'View SOW document'}>
                              <FileText size={12} />
                              {s.file_name ? (s.file_name.length > 16 ? s.file_name.slice(0, 16) + '…' : s.file_name) : 'View'}
                              <ExternalLink size={10} />
                            </button>
                          )}
                          <label
                            title={s.file_url ? 'Replace document' : 'Upload SOW PDF'}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 text-slate-500 text-[11px] font-medium hover:bg-slate-100 cursor-pointer transition-colors"
                          >
                            {uploadingId === s.id
                              ? <RefreshCw size={11} className="animate-spin" />
                              : (s.file_url ? <Paperclip size={11} /> : <Upload size={11} />)}
                            {!s.file_url && <span>{uploadingId === s.id ? 'Uploading…' : 'Upload'}</span>}
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                              onChange={(e) => handleRowUpload(s, e)} disabled={uploadingId === s.id} />
                          </label>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{fmtShort(s.created_at || s.start_date)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${ss.color}`}>{ss.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                        {s.status === 'draft' && (
                          <button onClick={() => action(s.id, 'submit')} disabled={busy('submit')} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 disabled:opacity-50">
                            <Send size={11} strokeWidth={2.2} /> Send Draft
                          </button>
                        )}
                        {s.status === 'submitted_for_finance' && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => action(s.id, 'check-approval')} disabled={busy('check-approval')} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-blue-500 text-white text-[11px] font-semibold hover:bg-blue-600 disabled:opacity-50">
                              <RefreshCw size={11} strokeWidth={2.2} className={busy('check-approval') ? 'animate-spin' : ''} /> Check Approval
                            </button>
                          </div>
                        )}
                        {s.status === 'changes_requested' && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 font-medium">Changes Requested</span>
                            <button onClick={() => action(s.id, 'review-changes')} disabled={busy('review-changes')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-orange-100 text-orange-700 text-[10px] font-semibold hover:bg-orange-200 disabled:opacity-50">
                              <Eye size={10} strokeWidth={2.2} /> Review
                            </button>
                            <button onClick={() => action(s.id, 'resend')} disabled={busy('resend')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-amber-500 text-white text-[10px] font-semibold hover:bg-amber-600 disabled:opacity-50">
                              <Send size={10} strokeWidth={2.2} /> Resend
                            </button>
                          </div>
                        )}
                        {s.status === 'finance_approved' && (
                          <button onClick={() => action(s.id, 'send-for-signature')} disabled={busy('send-for-signature')} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-violet-500 text-white text-[11px] font-semibold hover:bg-violet-600 disabled:opacity-50">
                            <FileSignature size={11} strokeWidth={2.2} /> Send DocuSign
                          </button>
                        )}
                        {s.status === 'sent_for_signature' && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] text-violet-500 italic"><RefreshCw size={10} className="animate-pulse" /> Awaiting signature</span>
                            <button onClick={() => action(s.id, 'check-docusign')} disabled={busy('check-docusign')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200 disabled:opacity-50">
                              <RefreshCw size={10} strokeWidth={2.2} /> Check
                            </button>
                          </div>
                        )}
                        {s.status === 'signed' && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => action(s.id, 'activate')} disabled={busy('activate')} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 disabled:opacity-50">
                              <PlayCircle size={11} strokeWidth={2.2} /> Activate
                            </button>
                            <button onClick={() => window.open(`/api/sow/docusign-status?sow_id=${s.id}&download=true`, '_blank')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200">
                              <FileText size={10} strokeWidth={2.2} /> Download
                            </button>
                          </div>
                        )}
                        {(s.status === 'active' || s.status === 'rejected' || s.status === 'cancelled') && (
                          <span className="text-[11px] text-slate-300">-</span>
                        )}
                          <button onClick={() => deleteSow(s)} disabled={deletingId === s.id} title="Delete SOW"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                            {deletingId === s.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} strokeWidth={1.8} />}
                          </button>
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

      {/* ═══ Multi-step Modal: Form → Preview → Email Compose ═══ */}
      <Modal isOpen={modalOpen} onClose={() => {
        if (step === 'preview') { setStep('form'); }
        else if (step === 'email' && createdSow && !createdSow._fromTable) { setStep('preview'); }
        else { setModalOpen(false); }
      }} title={
        step === 'form' ? 'New SOW / Quote' : step === 'preview' ? 'SOW Document Preview' : step === 'changes' ? 'Changes Requested by Finance' : 'Compose Email'
      } maxWidth={step === 'form' ? 'max-w-2xl' : 'max-w-4xl'}>

        {/* ── Step 1: SOW Form ── */}
        {step === 'form' && (
          <form onSubmit={createDraft} className="space-y-4">
            {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Salesforce - Q3 Module Expansion" className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client *</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={inputClass}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Project (optional)</label>
                <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={inputClass}>
                  <option value="">-</option>
                  {projects.filter(p => !form.client_id || p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Type</label>
                <select value={form.sow_type} onChange={(e) => setForm({ ...form, sow_type: e.target.value })} className={inputClass}>
                  <option value="project">New Project</option>
                  <option value="resource">New Resource</option>
                  <option value="amendment">Amendment</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Contract Value</label>
                <input type="number" min="0" step="0.01" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass}>
                  <option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option><option value="AED">AED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Start / Effective Date</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">End Date</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Resource Name</label>
                <input value={form.resource_name} onChange={(e) => setForm({ ...form, resource_name: e.target.value })} placeholder="e.g. John Doe" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Role / Requirement</label>
                <input value={form.resource_role} onChange={(e) => setForm({ ...form, resource_role: e.target.value })} placeholder="e.g. IT Engineer" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Rate ($/hr)</label>
                <input type="number" min="0" step="0.01" value={form.resource_rate} onChange={(e) => setForm({ ...form, resource_rate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Location</label>
                <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass}>
                  <option value="Offshore">Offshore</option>
                  <option value="Onsite">Onsite</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Scope / Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the scope of work, deliverables, etc." className="w-full p-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
            </div>

            {/* SOW document (PDF) upload */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SOW Document (PDF)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-amber-400 transition-colors">
                {form.file_url ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span className="text-[13px] font-medium text-slate-700">{form.file_name || 'Uploaded document'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-blue-600 hover:text-blue-800">View</a>
                      <button type="button" onClick={() => setForm({ ...form, file_url: '', file_name: '' })} className="text-[12px] font-semibold text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload size={20} className="text-slate-400 mb-1" />
                    <span className="text-[12px] text-slate-500">{uploading ? 'Uploading...' : 'Click to upload the SOW PDF'}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PDF, Word — max 10MB</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFormUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </div>

            {/* Preview table */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="py-2 px-4 text-left font-semibold">Requirements</th>
                    <th className="py-2 px-4 text-center font-semibold">Qty</th>
                    <th className="py-2 px-4 text-center font-semibold">Hourly Rate</th>
                    <th className="py-2 px-4 text-left font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 bg-white">
                    <td className="py-2 px-4">{form.resource_role || form.title || '-'}</td>
                    <td className="py-2 px-4 text-center">{form.quantity || 1}</td>
                    <td className="py-2 px-4 text-center font-semibold">{form.resource_rate ? `$${form.resource_rate}` : '-'}</td>
                    <td className="py-2 px-4">{form.location || 'Offshore'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60">
                {saving ? 'Creating...' : 'Create Draft & Preview'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Document Preview ── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 max-h-[60vh] overflow-y-auto shadow-inner" dangerouslySetInnerHTML={{ __html: sowHtml }} />
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button type="button" onClick={() => { setStep('form'); }} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                <ArrowLeft size={14} /> Back to Edit
              </button>
              <button onClick={() => setStep('email')} className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700">
                <span className="inline-flex items-center gap-1.5"><Mail size={14} /> Compose Email</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Email Compose UI ── */}
        {step === 'email' && (
          <div className="space-y-3">
            {/* Email header fields */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200/70">
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 w-14">To:</label>
                <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-amber-500" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 w-14">Subject:</label>
                <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            {/* Attachment chip */}
            <div className="flex items-center gap-2 px-1">
              <Paperclip size={13} className="text-slate-400" />
              <button
                type="button"
                onClick={() => setShowDocPreview(!showDocPreview)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[12px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <FileText size={12} />
                SOW_{createdSow?.sow_number || 'draft'}.html
                <Eye size={11} className="ml-1 opacity-60" />
              </button>
              <span className="text-[10px] text-slate-400">Click to preview</span>
            </div>

            {/* Inline document preview */}
            <AnimatePresence>
              {showDocPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-slate-200 rounded-xl p-5 max-h-[35vh] overflow-y-auto shadow-inner">
                    <div dangerouslySetInnerHTML={{ __html: sowHtml }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email body */}
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={8}
              className="w-full p-4 rounded-xl border border-slate-200 text-[13px] leading-relaxed focus:outline-none focus:border-amber-500 bg-white"
            />

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setStep(createdSow ? 'preview' : 'form')} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                  Save as Draft
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !emailTo}
                  className="inline-flex items-center gap-1.5 h-10 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[13px] font-semibold shadow-lg shadow-blue-600/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-60"
                >
                  <Send size={14} /> {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Changes Requested Review + Edit ── */}
        {step === 'changes' && createdSow && (
          <div className="space-y-4">
            {/* Finance feedback */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-orange-700 uppercase tracking-wider">Finance Feedback</span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-orange-100 text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                {createdSow.finance_notes || 'No details provided.'}
              </div>
            </div>

            {/* Editable SOW fields */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Edit SOW Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Contract Value</label>
                  <input type="number" min="0" step="0.01" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Role / Requirement</label>
                  <input value={form.resource_role} onChange={(e) => setForm({ ...form, resource_role: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Rate ($/hr)</label>
                  <input type="number" min="0" step="0.01" value={form.resource_rate} onChange={(e) => setForm({ ...form, resource_rate: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Location</label>
                  <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass}>
                    <option value="Offshore">Offshore</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Scope / Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full p-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            {error && <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>}

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                Close
              </button>
              <button
                onClick={async () => {
                  setSaving(true); setError('');
                  try {
                    // Save updated fields to DB
                    await api.put(`/sows/${createdSow.id}`, {
                      status: 'draft',
                      title: form.title,
                      contract_value: Number(form.contract_value) || 0,
                      resource_role: form.resource_role,
                      resource_rate: form.resource_rate ? Number(form.resource_rate) : null,
                      description: form.description,
                    });
                    // Regenerate SOW document with new values
                    const clientLabel = clientMap[createdSow.client_id] || 'Client';
                    const html = buildSowHtml({ ...createdSow, ...form, sow_number: createdSow.sow_number }, clientLabel);
                    setSowHtml(html);
                    setCreatedSow({ ...createdSow, ...form, status: 'draft' });
                    // Prepare email
                    setEmailTo('gayathri.m@d4insight.com');
                    setEmailSubject(`SOW Revised - Approval Required: ${form.title} - ${createdSow.sow_number}`);
                    setEmailBody(`Hi,\n\nPlease review the revised Statement of Work. The requested changes have been incorporated.\n\nSOW: ${createdSow.sow_number}\nTitle: ${form.title}\nClient: ${clientLabel}\nValue: ${fmtMoney(form.contract_value, form.currency || createdSow.currency)}\nRate: $${form.resource_rate}/hr\n\nPlease reply with APPROVED or REJECTED.\n\nRegards,\nD4 Insight`);
                    setShowDocPreview(false);
                    setStep('preview');
                    load();
                  } catch (err) {
                    setError(err?.message || 'Failed to save changes');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold shadow-lg shadow-amber-600/25 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60"
              >
                <FileText size={14} /> {saving ? 'Saving...' : 'Apply Changes & Preview SOW'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
