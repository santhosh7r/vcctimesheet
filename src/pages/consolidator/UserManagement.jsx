import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserCog, Plus, Search, Pencil, Power, RotateCcw, Download, Eye, EyeOff, MapPin, Upload, FileText, ExternalLink } from 'lucide-react';
import { api, supabase, getFileUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTimesheets } from '../../context/TimesheetContext';
import { formatCtc, annualizedUsd } from '../../data/employeeSalaries';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import SortableHeader, { sortData } from '../../components/SortableHeader';

const ROLES = [
  { value: 'employee', label: 'Employee', color: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  { value: 'manager', label: 'Manager', color: 'bg-violet-50 text-violet-700 ring-violet-600/10' },
  { value: 'admin', label: 'Admin', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  { value: 'finance', label: 'Finance', color: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  { value: 'consultant', label: 'Consultant', color: 'bg-cyan-50 text-cyan-700 ring-cyan-600/10' },
  { value: 'client', label: 'Client', color: 'bg-sky-50 text-sky-700 ring-sky-600/10' },
];

const CLIENT_SUBROLES = [
  { value: 'finance', label: 'Client Finance' },
  { value: 'manager', label: 'Client Manager' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  { value: 'inactive', label: 'Inactive', color: 'bg-red-50 text-red-700 ring-red-600/10' },
  { value: 'bench', label: 'Bench', color: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
];

const LOCATIONS = ['India', 'USA', 'UAE'];
const CURRENCIES = ['INR', 'USD', 'AED'];
const CTC_PERIODS = ['annual', 'monthly', 'hourly'];

const roleStyle = (role) => ROLES.find(r => r.value === role) || ROLES[0];
const statusStyle = (status) => STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];

function maskCtc(text) {
  if (!text || text === '—') return text;
  return text.replace(/\d/g, '•');
}

const emptyForm = {
  id: '', name: '', email: '', phone: '', role: 'employee',
  designation: '', project: '', start_date: '', end_date: '', hourly_rate: '',
  employee_status: 'active', location_type: 'offshore', sow_number: '',
  // Client portal login (role === 'client')
  client_id: '', client_subrole: 'finance',
  // SOW document (mapped to sow_number in SOW Manager)
  sow_file_url: '', sow_file_name: '',
  // Salary fields
  location: 'India', ctc_amount: '', ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '',
};

export default function UserManagement({ clientView = false }) {
  const { user } = useAuth();
  const { projects: PROJECTS = [] } = useTimesheets();
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingSow, setUploadingSow] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const canSeeSalary = !clientView && (user?.role === 'admin' || user?.role === 'finance');

  const fetchData = useCallback(() => {
    setLoading(true);
    const promises = [api.get('/users?include_all=true')];
    if (canSeeSalary) promises.push(api.get('/employee-salaries').catch(() => ({ salaries: [] })));
    Promise.all(promises)
      .then(([userData, salaryData]) => {
        setUsers(userData.users || []);
        if (salaryData) setSalaries(salaryData.salaries || []);
      })
      .catch(() => { setUsers([]); setSalaries([]); })
      .finally(() => setLoading(false));
  }, [canSeeSalary]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Clients list — used to link a client-login user to its client company.
  useEffect(() => {
    api.get('/clients').then(d => setClients(d.clients || [])).catch(() => setClients([]));
  }, []);

  // Merge salary data into users by matching name (first_name + last_name vs user name)
  const mergedUsers = useMemo(() => {
    const salaryById = {};
    const salaryByName = {};
    for (const s of salaries) {
      salaryById[s.id] = s;
      // Build name key for fuzzy matching
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
      if (fullName) salaryByName[fullName] = s;
      // Also index by first_name alone for partial match
      if (s.first_name) salaryByName[s.first_name.trim().toLowerCase()] = s;
    }
    return users.map(u => {
      // Try exact ID match first
      let sal = salaryById[u.id] || null;
      if (!sal && u.name) {
        const uName = u.name.trim().toLowerCase();
        // Try full name match
        sal = salaryByName[uName] || null;
        // Try partial: find salary where user name contains first_name or vice versa
        if (!sal) {
          sal = salaries.find(s => {
            const fn = (s.first_name || '').trim().toLowerCase();
            const ln = (s.last_name || '').trim().toLowerCase();
            const full = `${fn} ${ln}`.trim();
            return fn && fn.length >= 3 && (uName.includes(fn) || fn.includes(uName) || uName.includes(full) || full.includes(uName));
          }) || null;
        }
      }
      return { ...u, _salary: sal };
    });
  }, [users, salaries]);

  // Deep-link from SOP Management's "Missing SOW" chips (and other entry points):
  //   ?edit=<userId> → open that user's edit modal (their profile view)
  //   ?q=<text>      → pre-fill the search box
  useEffect(() => {
    const editId = searchParams.get('edit');
    const q = searchParams.get('q');
    if (!editId && !q) return;
    if (q) setSearch(q);
    if (editId && mergedUsers.length) {
      const u = mergedUsers.find(x => x.id === editId);
      if (u) openEdit(u);
    }
    // Consume the params (and only once data is ready) so the modal doesn't re-open on refresh.
    if (!editId || mergedUsers.length) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      next.delete('q');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, mergedUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = mergedUsers
      .filter(u => showInactive ? true : u.is_active)
      .filter(u => (roleFilter ? u.role === roleFilter : true))
      .filter(u => (statusFilter ? u.employee_status === statusFilter : true))
      .filter(u => (projectFilter ? u.project === projectFilter : true))
      .filter(u => !q || u.name?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.project?.toLowerCase().includes(q));
    return sortData(base, sort, {
      hourly_rate: (u) => Number(u.hourly_rate) || 0,
      ctc: (u) => Number(u._salary?.ctc_amount) || 0,
      employee_status: (u) => u.employee_status || '',
      location_type: (u) => u.location_type || '',
    });
  }, [mergedUsers, search, roleFilter, statusFilter, projectFilter, showInactive, sort]);

  const counts = useMemo(() => {
    const active = users.filter(u => u.is_active);
    return {
      total: active.length,
      ...ROLES.reduce((acc, r) => ({ ...acc, [r.value]: active.filter(u => u.role === r.value).length }), {}),
      bench: users.filter(u => u.employee_status === 'bench').length,
      inactive: users.filter(u => !u.is_active).length,
    };
  }, [users]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = async (u) => {
    setEditingId(u.id);
    const sal = u._salary;
    setForm({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'employee',
      designation: u.designation || '',
      project: u.project || '',
      start_date: u.start_date || '',
      end_date: u.end_date || '',
      hourly_rate: u.hourly_rate ?? '',
      employee_status: u.employee_status || 'active',
      location_type: u.location_type || 'offshore',
      sow_number: u.sow_number || '',
      client_id: u.client_id || '',
      client_subrole: u.client_subrole || 'finance',
      sow_file_url: '', sow_file_name: '',
      // Salary
      location: sal?.location || 'India',
      ctc_amount: sal?.ctc_amount ?? '',
      ctc_currency: sal?.ctc_currency || 'INR',
      ctc_period: sal?.ctc_period || 'annual',
      ctc_raw: sal?.ctc_raw || '',
    });
    setError('');
    setModalOpen(true);
    // If this user has a SOW number, surface its existing uploaded file (if any)
    // so the editor can see what's currently mapped and replace it if needed.
    if (u.sow_number) {
      try {
        const resp = await api.get('/sows');
        const match = (resp.sows || []).find(s => s.sow_number === u.sow_number);
        if (match?.file_url) {
          setForm(prev => ({ ...prev, sow_file_url: match.file_url, sow_file_name: match.file_name || '' }));
        }
      } catch {
        // Non-fatal — leave the file fields blank.
      }
    }
  };

  // Upload the SOW PDF to the public 'documents' bucket; the URL is mapped to
  // the SOW Number (sows.sow_number) on submit so it shows in SOW Manager.
  const handleSowFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum 10MB.'); return; }
    setUploadingSow(true); setError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `sows/sow_${Date.now()}.${ext}`;
      if (supabase) {
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        setForm(f => ({ ...f, sow_file_url: urlData.publicUrl, sow_file_name: file.name }));
      } else {
        const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
        setForm(f => ({ ...f, sow_file_url: dataUrl, sow_file_name: file.name }));
      }
    } catch (err) {
      setError('SOW upload failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploadingSow(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim()) {
      setError('Employee ID and Name are required');
      return;
    }
    if (form.sow_file_url && !form.sow_number.trim()) {
      setError('Enter the SOW Number so the uploaded SOW document can be mapped in SOW Manager');
      return;
    }
    if (form.role === 'client' && !form.client_id) {
      setError('Select the Client company this login belongs to');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const isActive = form.employee_status !== 'inactive';
      const userPayload = {
        id: form.id,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        designation: form.designation,
        project: form.project || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        hourly_rate: form.hourly_rate === '' ? 0 : Number(form.hourly_rate),
        employee_status: form.employee_status,
        location_type: form.location_type || 'offshore',
        sow_number: form.sow_number || '',
        // Client portal login linkage (cleared for non-client roles)
        client_id: form.role === 'client' ? form.client_id : null,
        client_subrole: form.role === 'client' ? form.client_subrole : null,
        is_active: isActive,
        is_archived: form.employee_status === 'bench',
      };

      if (editingId) {
        await api.put(`/users/${editingId}`, userPayload);
      } else {
        await api.post('/users', userPayload);
      }

      // Save salary data if admin
      if (canSeeSalary && (form.ctc_amount !== '' || form.ctc_raw)) {
        const nameParts = form.name.trim().split(/\s+/);
        const salaryPayload = {
          id: form.id,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          title: form.designation || '',
          department: form.project || '',
          location: form.location || 'India',
          joined_date: form.start_date || '',
          ctc_amount: form.ctc_amount === '' ? null : Number(form.ctc_amount),
          ctc_currency: form.ctc_currency || 'INR',
          ctc_period: form.ctc_period || 'annual',
          ctc_raw: form.ctc_raw || '',
        };
        // Try update first, then create
        try {
          await api.put(`/employee-salaries/${form.id}`, salaryPayload);
        } catch {
          await api.post('/employee-salaries', salaryPayload).catch(() => {});
        }
      }

      // Map the uploaded SOW document to its SOW number (shows in SOW Manager).
      // Pass resource details so the SOW is auto-created with meaningful data
      // if no SOW exists yet with this number.
      if (form.sow_file_url && form.sow_number.trim()) {
        try {
          await api.post('/sows/attach-file', {
            sow_number: form.sow_number.trim(),
            file_url: form.sow_file_url,
            file_name: form.sow_file_name,
            title: form.project ? `${form.project} — ${form.name}` : `SOW ${form.sow_number.trim()}`,
            resource_name: form.name || null,
            resource_role: form.designation || null,
            resource_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
          });
        } catch (err) {
          alert('User saved, but the SOW document could not be mapped: ' + (err?.message || 'unknown error'));
        }
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    if (u.is_active) {
      if (!window.confirm(`Deactivate ${u.name}? They won't be able to log in.`)) return;
      await api.del(`/users/${u.id}`).catch(() => {});
    } else {
      await api.put(`/users/${u.id}`, { is_active: 1 }).catch(() => {});
    }
    fetchData();
  };

  const downloadCsv = () => {
    const header = ['ID', 'Name', 'Role', 'Project', 'Email', 'Phone', 'Designation', 'Location Type', 'Status', 'SOW Rate', 'Start Date', 'End Date'];
    if (canSeeSalary) header.push('Location', 'CTC Amount', 'Currency', 'CTC Period');
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const u of filtered) {
      const row = [u.id, u.name, u.role, u.project, u.email, u.phone, u.designation, u.location_type, u.employee_status, u.hourly_rate, u.start_date, u.end_date];
      if (canSeeSalary) {
        const sal = u._salary;
        row.push(sal?.location, sal?.ctc_amount, sal?.ctc_currency, sal?.ctc_period);
      }
      lines.push(row.map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = "w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-primary-500 transition-all";

  return (
    <>
      <PageHeader
        icon={UserCog}
        title={clientView ? 'Project Roster' : 'User Management'}
        subtitle={clientView ? 'Resources working on your engagements' : 'Manage all users, roles, projects, and compensation'}
        actions={
          <div className="flex items-center gap-2">
            {canSeeSalary && (
              <button
                onClick={() => setRevealed(v => !v)}
                className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                {revealed ? 'Hide CTC' : 'Show CTC'}
              </button>
            )}
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Download size={14} strokeWidth={2.2} />
              Export
            </button>
            {!clientView && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white text-[13px] font-semibold shadow-lg shadow-primary-600/25 hover:from-primary-700 hover:to-primary-800 transition-all"
              >
                <Plus size={16} strokeWidth={2.2} />
                Add User
              </button>
            )}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-3 md:grid-cols-8 gap-3 mb-6">
        <div className="bg-white border border-slate-200/70 rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Active</p>
          <p className="text-[22px] font-bold text-slate-900 mt-0.5">{counts.total}</p>
        </div>
        {ROLES.map(r => (
          <div key={r.value} className="bg-white border border-slate-200/70 rounded-2xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{r.label}s</p>
            <p className="text-[22px] font-bold text-slate-900 mt-0.5">{counts[r.value] || 0}</p>
          </div>
        ))}
        <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Bench</p>
          <p className="text-[22px] font-bold text-amber-900 mt-0.5">{counts.bench}</p>
        </div>
        <div className="bg-red-50/60 border border-red-200/50 rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Inactive</p>
          <p className="text-[22px] font-bold text-red-900 mt-0.5">{counts.inactive}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, email, or project"
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-primary-500 max-w-[200px]"
        >
          <option value="">All projects</option>
          {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          {projectFilter && !PROJECTS.includes(projectFilter) && <option value={projectFilter}>{projectFilter}</option>}
        </select>
        <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-400">Loading users...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No users match your filters" description="Try clearing search or filters, or create a new user." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70">
                  <SortableHeader label="ID" sortKey="id" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Role" sortKey="role" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Project" sortKey="project" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Location" sortKey="location_type" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="Status" sortKey="employee_status" currentSort={sort} onSort={setSort} />
                  <SortableHeader label="SOW Rate" sortKey="hourly_rate" currentSort={sort} onSort={setSort} align="right" />
                  {canSeeSalary && <SortableHeader label="CTC" sortKey="ctc" currentSort={sort} onSort={setSort} align="right" />}
                  {!clientView && <th className="text-right font-semibold text-slate-600 px-4 py-3 w-[100px]">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const rs = roleStyle(u.role);
                  const ss = statusStyle(u.employee_status);
                  const sal = u._salary;
                  const ctcFormatted = sal ? formatCtc(sal) : '—';
                  return (
                    <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50/40 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{u.id}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${rs.color}`}>
                          {rs.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[12px] max-w-[180px] truncate" title={u.project}>{u.project || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 capitalize">
                          <MapPin size={10} strokeWidth={2} />
                          {u.location_type || 'offshore'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${ss.color}`}>
                          {ss.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{u.hourly_rate ? `$${u.hourly_rate}/hr` : '—'}</td>
                      {canSeeSalary && (
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-700">
                          {revealed ? ctcFormatted : maskCtc(ctcFormatted)}
                        </td>
                      )}
                      {!clientView && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(u)}
                              title="Edit"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                            >
                              <Pencil size={14} strokeWidth={1.8} />
                            </button>
                            <button
                              onClick={() => toggleActive(u)}
                              title={u.is_active ? 'Deactivate' : 'Reactivate'}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                u.is_active
                                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active ? <Power size={14} strokeWidth={1.8} /> : <RotateCcw size={14} strokeWidth={1.8} />}
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

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit User' : 'Add New User'} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>
          )}

          {/* Section: Basic Info */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-3">Basic Information</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Employee ID *</label>
                <input
                  value={form.id}
                  disabled={!!editingId}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="e.g. 100700"
                  className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={inputClass}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section: Client Portal Access (only for client logins) */}
          {form.role === 'client' && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-3">Client Portal Access</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client Company *</label>
                  <select
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">-- Select client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Client Role *</label>
                  <select
                    value={form.client_subrole}
                    onChange={(e) => setForm({ ...form, client_subrole: e.target.value })}
                    className={inputClass}
                  >
                    {CLIENT_SUBROLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                This person signs in at the Client Portal (Vendor Tool) using their Employee ID above. Manager can approve SOWs, sign engagements & manage vendors; Finance reviews SOWs & approves invoices.
              </p>
            </div>
          )}

          {/* Section: Work Details */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-3">Work Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Designation</label>
                <input
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Project</label>
                <select
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  className={inputClass}
                >
                  <option value="">-- None --</option>
                  {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
                  {form.project && !PROJECTS.includes(form.project) && (
                    <option value={form.project}>{form.project}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                <div className="flex gap-1.5">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setForm({ ...form, employee_status: opt.value })}
                      className={`flex-1 h-10 rounded-xl text-[12px] font-semibold border-2 transition-all ${
                        form.employee_status === opt.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Location Type</label>
                <select
                  value={form.location_type}
                  onChange={(e) => setForm({ ...form, location_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="offshore">Offshore</option>
                  <option value="onsite">Onsite</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SOW Number</label>
                <input
                  value={form.sow_number}
                  onChange={(e) => setForm({ ...form, sow_number: e.target.value })}
                  placeholder="e.g. 202604003"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SOW Rate ($/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {/* SOW Document upload — mapped to the SOW Number above in SOW Manager */}
            <div className="mt-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">SOW Document (PDF)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-primary-400 transition-colors">
                {form.sow_file_url ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span className="text-[13px] font-medium text-slate-700">{form.sow_file_name || 'Uploaded document'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={async () => { const u = await getFileUrl(form.sow_file_url); if (u) window.open(u, '_blank', 'noopener'); }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-800">View <ExternalLink size={11} /></button>
                      <button type="button" onClick={() => setForm({ ...form, sow_file_url: '', sow_file_name: '' })} className="text-[12px] font-semibold text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload size={20} className="text-slate-400 mb-1" />
                    <span className="text-[12px] text-slate-500">{uploadingSow ? 'Uploading...' : 'Click to upload the SOW PDF'}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Mapped to the SOW Number above and shown in SOW Manager — PDF, Word, max 10MB</span>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleSowFileUpload} disabled={uploadingSow} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Section: Compensation (admin/finance only) */}
          {canSeeSalary && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-3">Compensation</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Location</label>
                  <select
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className={inputClass}
                  >
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">CTC Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.ctc_amount}
                    onChange={(e) => setForm({ ...form, ctc_amount: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Currency</label>
                  <select
                    value={form.ctc_currency}
                    onChange={(e) => setForm({ ...form, ctc_currency: e.target.value })}
                    className={inputClass}
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Period</label>
                  <select
                    value={form.ctc_period}
                    onChange={(e) => setForm({ ...form, ctc_period: e.target.value })}
                    className={inputClass}
                  >
                    {CTC_PERIODS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Original CTC Text</label>
                <input
                  value={form.ctc_raw}
                  onChange={(e) => setForm({ ...form, ctc_raw: e.target.value })}
                  placeholder="e.g. $120,000 per year"
                  className={inputClass}
                />
              </div>
            </div>
          )}

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
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
