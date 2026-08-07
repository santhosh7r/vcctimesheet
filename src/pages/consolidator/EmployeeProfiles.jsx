import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Search, Pencil, Trash2, Upload, Download, FileText, Check, X, Filter } from 'lucide-react';
import { api, supabase, useSupabase } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTimesheets } from '../../context/TimesheetContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import FileUpload from '../../components/FileUpload';

const docTypeOptions = [
  { value: 'sow', label: 'SOW' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  { value: 'inactive', label: 'Inactive', color: 'bg-red-50 text-red-700 ring-red-600/10' },
  { value: 'bench', label: 'Bench', color: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
];

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset ${opt.color}`}>
      {opt.label}
    </span>
  );
}

export default function EmployeeProfiles() {
  const { user } = useAuth();
  const { projects: PROJECTS } = useTimesheets();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docType, setDocType] = useState('sow');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({
    id: '', name: '', email: '', phone: '', role: 'employee', designation: '',
    project: '', start_date: '', end_date: '', hourly_rate: '', employee_status: 'active',
    sow_number: '',
  });
  const [addSowFile, setAddSowFile] = useState(null);
  const [addOfferFile, setAddOfferFile] = useState(null);

  const [sowMap, setSowMap] = useState({});

  const [billingByUser, setBillingByUser] = useState({});

  const fetchEmployees = useCallback(() => {
    const isFinance = user?.role === 'admin' || user?.role === 'finance';
    Promise.all([
      api.get('/users?include_all=true'),
      api.get('/sow-resources').catch(() => ({ resources: [] })),
      isFinance ? api.get('/finance/employee-billing').catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    ]).then(([data, sowRes, billingRes]) => {
      const billingMap = {};
      for (const it of (billingRes.items || [])) billingMap[it.user_id] = it;
      setBillingByUser(billingMap);
      // Continue with existing logic — fall through to the original handler.
      return [data, sowRes];
    }).then(([data, sowRes]) => {
      const users = (data.users || [])
        .filter(u => u.role === 'employee' || u.role === 'manager' || u.role === 'admin')
        .map(u => ({
          ...u,
          employee_status: u.employee_status || (u.is_active === false ? 'inactive' : u.is_archived ? 'bench' : 'active'),
        }));
      setEmployees(users);
      // Build SOW rate lookup by name
      const map = {};
      (sowRes.resources || []).forEach(r => {
        if (r.name) map[r.name.toLowerCase().trim()] = r.rate || 0;
      });
      setSowMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const [sowInfo, setSowInfo] = useState(null);

  const openProfile = async (emp) => {
    setSelectedEmployee(emp);
    setSowInfo(null);
    const data = await api.get(`/documents?userId=${emp.id}`).catch(() => ({ documents: [] }));
    setDocuments(data.documents || []);
    // Look up SOW from sow_resources table by name (exact or fuzzy)
    try {
      const sowData = await api.get('/sow-resources');
      const empName = (emp.name || '').toLowerCase().trim();
      const empParts = empName.split(/\s+/);
      let match = (sowData.resources || []).find(r =>
        r.name && (r.name.toLowerCase().trim() === empName)
      );
      // Fuzzy: match if first name + start of last name match
      if (!match && empParts.length > 0) {
        match = (sowData.resources || []).find(r => {
          const rn = (r.name || '').toLowerCase().trim();
          const rParts = rn.split(/\s+/);
          if (rParts[0] === empParts[0]) {
            if (rParts.length > 1 && empParts.length > 1) return rParts[1].slice(0,3) === empParts[1].slice(0,3);
            return rParts.length === 1 || empParts.length === 1;
          }
          return rn.includes(empName) || empName.includes(rn);
        });
      }
      if (match && match.sow_number) {
        setSowInfo({ sow_number: match.sow_number, sow_file: match.sow_file, status: match.status, rate: match.rate });
      }
    } catch {}
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      role: emp.role || 'employee',
      designation: emp.designation || '',
      project: emp.project || '',
      location_type: emp.location_type || 'offshore',
      start_date: emp.start_date ? emp.start_date.split('T')[0] : '',
      end_date: emp.end_date ? emp.end_date.split('T')[0] : '',
      hourly_rate: emp.hourly_rate || '',
      employee_status: emp.employee_status || 'active',
      sow_number: emp.sow_number || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      const isActive = editForm.employee_status !== 'inactive';
      const isArchived = editForm.employee_status === 'bench';
      await api.put(`/users/${editingEmployee.id}`, {
        name: editForm.name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        role: editForm.role,
        designation: editForm.designation,
        project: editForm.project,
        location_type: editForm.location_type || 'offshore',
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        hourly_rate: parseFloat(editForm.hourly_rate) || 0,
        employee_status: editForm.employee_status,
        sow_number: editForm.sow_number || '',
        is_active: isActive,
        is_archived: isArchived,
      });
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (emp, newStatus) => {
    try {
      const isActive = newStatus !== 'inactive';
      const isArchived = newStatus === 'bench';
      await api.put(`/users/${emp.id}`, {
        employee_status: newStatus,
        is_active: isActive,
        is_archived: isArchived,
      });
      fetchEmployees();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedEmployee) return;
    setUploading(true);
    try {
      let storagePath = null;
      let fileSize = uploadFile.size;
      let mimeType = uploadFile.type;

      if (useSupabase && supabase) {
        storagePath = `${selectedEmployee.id}/${Date.now()}_${uploadFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, uploadFile, { contentType: mimeType });
        if (uploadError) throw uploadError;
      }

      await api.post('/documents', {
        userId: selectedEmployee.id,
        docType: docType,
        uploadedBy: user.id,
        fileName: uploadFile.name,
        storagePath,
        fileSize,
        mimeType,
      });
      const data = await api.get(`/documents?userId=${selectedEmployee.id}`);
      setDocuments(data.documents || []);
      setUploadFile(null);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  const handleDownload = async (doc) => {
    if (useSupabase && supabase && doc.storage_path) {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);
      if (error) { console.error('Download error:', error); return; }
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert(`Demo mode: Download of "${doc.original_name}" is simulated.`);
    }
  };

  const handleDeleteDoc = async (docId) => {
    await api.del(`/documents/${docId}`);
    const data = await api.get(`/documents?userId=${selectedEmployee.id}`);
    setDocuments(data.documents || []);
  };

  const handleAddEmployee = async () => {
    if (!form.id || !form.name) return;
    setSaving(true);
    try {
      await api.post('/users', {
        ...form,
        hourly_rate: parseFloat(form.hourly_rate) || 0,
        is_active: form.employee_status !== 'inactive',
        is_archived: form.employee_status === 'bench',
      });

      // Upload SOW file if attached
      if (addSowFile && useSupabase && supabase) {
        const storagePath = `${form.id}/${Date.now()}_${addSowFile.name}`;
        await supabase.storage.from('documents').upload(storagePath, addSowFile, { contentType: addSowFile.type });
        await api.post('/documents', { userId: form.id, docType: 'sow', uploadedBy: user.id, fileName: addSowFile.name, storagePath, fileSize: addSowFile.size, mimeType: addSowFile.type });
      }

      // Upload Offer Letter if attached
      if (addOfferFile && useSupabase && supabase) {
        const storagePath = `${form.id}/${Date.now()}_${addOfferFile.name}`;
        await supabase.storage.from('documents').upload(storagePath, addOfferFile, { contentType: addOfferFile.type });
        await api.post('/documents', { userId: form.id, docType: 'offer_letter', uploadedBy: user.id, fileName: addOfferFile.name, storagePath, fileSize: addOfferFile.size, mimeType: addOfferFile.type });
      }

      setShowAddModal(false);
      setForm({ id: '', name: '', email: '', phone: '', role: 'employee', designation: '', project: '', start_date: '', end_date: '', hourly_rate: '', employee_status: 'active', sow_number: '' });
      setAddSowFile(null);
      setAddOfferFile(null);
      fetchEmployees();
    } catch (err) {
      console.error('Add employee failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (empId) => {
    await api.del(`/users/${empId}`);
    setDeleteConfirm(null);
    fetchEmployees();
  };

  const projects = [...new Set(employees.map(e => e.project).filter(Boolean))].sort();
  const filtered = employees.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.id.includes(search)) return false;
    if (projectFilter && e.project !== projectFilter) return false;
    if (statusFilter && e.employee_status !== statusFilter) return false;
    return true;
  });

  const counts = {
    all: employees.length,
    active: employees.filter(e => e.employee_status === 'active').length,
    inactive: employees.filter(e => e.employee_status === 'inactive').length,
    bench: employees.filter(e => e.employee_status === 'bench').length,
  };

  const roleCounts = {
    employees: employees.filter(e => e.role === 'employee').length,
    managers: employees.filter(e => e.role === 'manager').length,
    admins: employees.filter(e => e.role === 'admin').length,
  };

  const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all";

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Employee Management"
        subtitle="Manage employees, projects, and status"
        actions={
          <button onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> Add Employee
          </button>
        }
      />

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Total', count: counts.all, color: 'bg-slate-50 border-slate-200/60 text-slate-700', filter: '' },
          { label: 'Active', count: counts.active, color: 'bg-emerald-50 border-emerald-200/60 text-emerald-700', filter: 'active' },
          { label: 'Bench', count: counts.bench, color: 'bg-amber-50 border-amber-200/60 text-amber-700', filter: 'bench' },
          { label: 'Inactive', count: counts.inactive, color: 'bg-red-50 border-red-200/60 text-red-700', filter: 'inactive' },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => setStatusFilter(statusFilter === card.filter ? '' : card.filter)}
            className={`rounded-xl border p-3 text-left transition-all ${card.color} ${statusFilter === card.filter ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow-sm'}`}
          >
            <p className="text-[22px] font-bold">{card.count}</p>
            <p className="text-[11px] font-medium opacity-70">{card.label}</p>
          </button>
        ))}
      </div>
      {/* Role Breakdown */}
      <div className="flex gap-3 mb-5">
        {[
          { label: 'Employees', count: roleCounts.employees, color: 'text-slate-600' },
          { label: 'Managers', count: roleCounts.managers, color: 'text-purple-600' },
          { label: 'Admins', count: roleCounts.admins, color: 'text-primary-600' },
        ].map(r => (
          <span key={r.label} className={`text-xs font-medium ${r.color} bg-white border border-slate-200 rounded-lg px-2.5 py-1`}>
            {r.count} {r.label}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
        </div>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-800">{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-slate-400">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">ID</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Role</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Email (D4)</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Project</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Location</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Rate</th>
                  {(user?.role === 'admin' || user?.role === 'finance') && (
                    <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Billed</th>
                  )}
                  <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => {
                  const sowRate = sowMap[(emp.name || '').toLowerCase().trim()];
                  const locType = emp.location_type || 'offshore';
                  return (
                  <motion.tr key={emp.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                    <td className="py-2.5 px-4 text-[12px] text-slate-500 font-mono tabular-nums">{emp.id}</td>
                    <td className="py-2.5 px-4">
                      <button onClick={() => openProfile(emp)} className="text-[13px] font-medium text-slate-800 hover:text-primary-600 transition-colors text-left">
                        {emp.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium capitalize ${
                        emp.role === 'manager' ? 'bg-purple-50 text-purple-700' : emp.role === 'admin' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[160px] truncate">{emp.email || '-'}</td>
                    <td className="py-2.5 px-4 text-[12px] text-slate-600 max-w-[160px] truncate">{emp.project || '-'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold capitalize ${
                        locType.includes('onsite') ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        {locType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4"><StatusBadge status={emp.employee_status} /></td>
                    <td className="py-2.5 px-4 text-[12px] text-slate-700 tabular-nums">{sowRate !== undefined ? `$${sowRate}/hr` : '-'}</td>
                    {(user?.role === 'admin' || user?.role === 'finance') && (() => {
                      const b = billingByUser[emp.id];
                      return (
                        <td className="py-2.5 px-4 text-right text-[12px] tabular-nums">
                          {b && b.revenue > 0 ? (
                            <span className="font-semibold text-emerald-700" title={`${Math.round(b.hours)} hrs across ${Object.keys(b.by_project || {}).length} project(s)`}>
                              ${Math.round(b.revenue).toLocaleString('en-US')}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })()}
                    <td className="py-2.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(emp)} title="Edit"
                          className="p-1.5 text-slate-500 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(emp)} title="Delete"
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Employee">
        {deleteConfirm && (
          <div>
            <p className="text-sm text-slate-600 mb-2">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong> ({deleteConfirm.id})?
            </p>
            <p className="text-xs text-slate-400 mb-5">This will deactivate the employee. Their timesheet data will be preserved.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={() => handleDeleteEmployee(deleteConfirm.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Delete</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={!!editingEmployee} onClose={() => setEditingEmployee(null)} title={`Edit: ${editingEmployee?.name || ''}`} maxWidth="max-w-2xl">
        {editingEmployee && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Employee ID</label>
                <input type="text" value={editingEmployee.id} disabled
                  className="w-full px-3 py-2 text-sm border-2 border-slate-100 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Name *</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={inputClass}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
                <input type="text" value={editForm.designation} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Project</label>
                <select value={editForm.project} onChange={e => setEditForm({ ...editForm, project: e.target.value })} className={inputClass}>
                  <option value="">-- Select Project --</option>
                  {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
                  {editForm.project && !PROJECTS.includes(editForm.project) && (
                    <option value={editForm.project}>{editForm.project}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                <div className="flex gap-2 mt-0.5">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm({ ...editForm, employee_status: opt.value })}
                      className={`flex-1 px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all ${
                        editForm.employee_status === opt.value
                          ? opt.value === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : opt.value === 'bench' ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Location Type</label>
              <select value={editForm.location_type} onChange={e => setEditForm({ ...editForm, location_type: e.target.value })} className={inputClass}>
                <option value="onsite">Onsite</option>
                <option value="offshore">Offshore</option>
                <option value="remote_offshore">Remote Offshore</option>
                <option value="remote_onsite">Remote Onsite</option>
              </select>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SOW Number</label>
                <input type="text" value={editForm.sow_number} onChange={e => setEditForm({ ...editForm, sow_number: e.target.value })} placeholder="e.g. 202604003" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Hourly Rate ($)</label>
                <input type="number" value={editForm.hourly_rate} onChange={e => setEditForm({ ...editForm, hourly_rate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                <input type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                <input type="date" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setEditingEmployee(null)}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editForm.name}
                className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25 disabled:opacity-50 flex items-center gap-2">
                <Check size={14} />{saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Employee Profile / Documents Modal */}
      <Modal isOpen={!!selectedEmployee} onClose={() => setSelectedEmployee(null)} title={selectedEmployee?.name || 'Employee Profile'} maxWidth="max-w-3xl">
        {selectedEmployee && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-semibold">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">{selectedEmployee.name}</p>
                  <p className="text-[11px] text-slate-400">{selectedEmployee.id} &middot; {selectedEmployee.project || 'No project'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedEmployee.employee_status} />
                <button onClick={() => { setSelectedEmployee(null); openEditModal(selectedEmployee); }}
                  className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                  <Pencil size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Role', value: selectedEmployee.role },
                { label: 'Designation', value: selectedEmployee.designation || '-' },
                { label: 'Hourly Rate', value: `$${sowInfo?.rate || selectedEmployee.hourly_rate || 0}/hr` },
                { label: 'SOW Number', value: sowInfo?.sow_number || selectedEmployee.sow_number || '-' },
                { label: 'Email', value: selectedEmployee.email || '-' },
                { label: 'Start Date', value: selectedEmployee.start_date ? new Date(selectedEmployee.start_date).toLocaleDateString() : '-' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</div>
                  <div className="text-[13px] font-medium text-slate-800 capitalize mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Billing breakdown — admin/finance only */}
            {(user?.role === 'admin' || user?.role === 'finance') && billingByUser[selectedEmployee.id] && (
              <div className="mb-5 p-4 bg-amber-50/40 border border-amber-200/40 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Total Billed (rate × hours)</p>
                    <p className="text-[22px] font-bold text-amber-900 tabular-nums tracking-[-0.02em] mt-0.5">${Math.round(billingByUser[selectedEmployee.id].revenue).toLocaleString('en-US')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-amber-700/70">{Math.round(billingByUser[selectedEmployee.id].hours)} hours</p>
                    <p className="text-[10px] text-amber-700/60 mt-0.5">across {Object.keys(billingByUser[selectedEmployee.id].by_project || {}).length} project(s)</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {Object.values(billingByUser[selectedEmployee.id].by_project || {}).sort((a, b) => b.revenue - a.revenue).map(p => (
                    <div key={p.project} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-700 truncate flex-1">{p.project}</span>
                      <span className="text-slate-500 tabular-nums mx-3">{Math.round(p.hours)}h</span>
                      <span className="font-semibold text-slate-900 tabular-nums">${Math.round(p.revenue).toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SOW Document from sow_resources */}
            {sowInfo && sowInfo.sow_file && (
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200/60 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileText size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-emerald-800">SOW Document — {sowInfo.sow_number}</p>
                      <p className="text-[11px] text-emerald-600">{sowInfo.sow_file}</p>
                    </div>
                  </div>
                  <a href={`/sow-files/${sowInfo.sow_file}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[12px] font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                    <Download size={13} /> View SOW
                  </a>
                </div>
              </div>
            )}
            {sowInfo && !sowInfo.sow_file && (
              <div className="mb-5 p-3 bg-amber-50 border border-amber-200/60 rounded-xl">
                <p className="text-[12px] text-amber-700 font-medium">SOW {sowInfo.sow_number} mapped but document file not yet uploaded.</p>
              </div>
            )}

            {/* Quick Status Change */}
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Status Change</p>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      handleQuickStatusChange(selectedEmployee, opt.value);
                      setSelectedEmployee({ ...selectedEmployee, employee_status: opt.value });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                      selectedEmployee.employee_status === opt.value
                        ? opt.value === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : opt.value === 'bench' ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <h4 className="text-[12px] font-semibold text-slate-700 mb-3">Documents</h4>
            {documents.length > 0 && (
              <div className="space-y-2 mb-4">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-slate-400" />
                      <span className="text-sm text-slate-700">{doc.original_name}</span>
                      <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-xs capitalize">{doc.doc_type.replace('_', ' ')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownload(doc)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><Download size={14} /></button>
                      <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 mt-4">
              <h4 className="text-[12px] font-semibold text-slate-700 mb-3">Upload New Document</h4>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <FileUpload onFileSelect={setUploadFile} accept=".pdf,.doc,.docx" label="Select File" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)}
                    className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
                    {docTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <button onClick={handleUpload} disabled={!uploadFile || uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25 disabled:opacity-50">
                  <Upload size={14} /> Upload
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Employee Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Employee">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Employee ID *</label>
              <input type="text" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputClass}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Project</label>
              <select value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} className={inputClass}>
                <option value="">-- Select Project --</option>
                {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SOW Number</label>
              <input type="text" value={form.sow_number} onChange={e => setForm({ ...form, sow_number: e.target.value })} placeholder="e.g. 202604003" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Hourly Rate ($)</label>
              <input type="number" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Designation</label>
              <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Senior Developer" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <div className="flex gap-2 mt-0.5">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, employee_status: opt.value })}
                    className={`flex-1 px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all ${
                      form.employee_status === opt.value
                        ? opt.value === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : opt.value === 'bench' ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Document Uploads */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Attach Documents (Optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">SOW Document</label>
                <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-xl cursor-pointer transition-all ${addSowFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-primary-400'}`}>
                  <FileText size={14} className={addSowFile ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-sm text-slate-600 truncate">{addSowFile ? addSowFile.name : 'Choose file...'}</span>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setAddSowFile(e.target.files[0] || null)} />
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Offer Letter</label>
                <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-xl cursor-pointer transition-all ${addOfferFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-primary-400'}`}>
                  <FileText size={14} className={addOfferFile ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-sm text-slate-600 truncate">{addOfferFile ? addOfferFile.name : 'Choose file...'}</span>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setAddOfferFile(e.target.files[0] || null)} />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleAddEmployee} disabled={saving || !form.id || !form.name}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25 disabled:opacity-50 flex items-center gap-2">
              {saving ? 'Creating...' : 'Add Employee'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
