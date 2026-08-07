import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CalendarOff, Download, Calendar, Clock, CheckCircle2, ChevronLeft, ChevronRight, Users, Filter, Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const leaveTypeLabels = {
  casual: 'Casual', sick: 'Sick', earned: 'Earned', unpaid: 'Unpaid', wfh: 'WFH', comp_off: 'Comp Off',
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function calcDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  let count = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count || 1;
}

const emptyForm = { userId: '', leaveType: 'casual', startDate: '', endDate: '', reason: '', status: 'approved' };

export default function LeaveOverview() {
  const now = new Date();
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [viewMode, setViewMode] = useState('month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const dateRange = useMemo(() => {
    if (viewMode === 'month') {
      const from = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const to = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;
      return { from, to };
    }
    if (viewMode === 'year') {
      return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    }
    return { from: customFrom, to: customTo };
  }, [viewMode, selectedYear, selectedMonth, customFrom, customTo]);

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);
    if (projectFilter) params.set('project', projectFilter);

    setLoading(true);
    Promise.all([
      api.get(`/leaves?${params}`),
      api.get('/users?include_all=true'),
    ]).then(([leaveData, userData]) => {
      setLeaves(leaveData.leaves || []);
      const allUsers = userData.users || [];
      setUsers(allUsers);
      const uniqueProjects = [...new Set(allUsers.filter(u => u.project).map(u => u.project))].sort();
      setProjects(uniqueProjects);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to, projectFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const activeUsers = useMemo(() => users.filter(u => u.is_active).sort((a, b) => a.name.localeCompare(b.name)), [users]);

  const filtered = useMemo(() => {
    return leaves.filter(l => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (typeFilter && l.leave_type !== typeFilter) return false;
      if (employeeFilter && l.user_id !== employeeFilter) return false;
      return true;
    });
  }, [leaves, statusFilter, typeFilter, employeeFilter]);

  const employeeOptions = useMemo(() => {
    const ids = [...new Set(leaves.map(l => l.user_id))];
    return ids.map(id => ({ id, name: userMap[id]?.name || leaves.find(l => l.user_id === id)?.user_name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leaves, userMap]);

  const pendingCount = filtered.filter(l => l.status === 'pending').length;
  const approvedDays = filtered.filter(l => l.status === 'approved').reduce((s, l) => s + (l.days_count || 0), 0);
  const rejectedCount = filtered.filter(l => l.status === 'rejected').length;

  const navMonth = (dir) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const exportCSV = () => {
    const header = 'Employee,Project,Type,Start Date,End Date,Days,Reason,Status\n';
    const rows = filtered.map(l => {
      const emp = userMap[l.user_id];
      return `"${l.user_name || l.user_id}","${emp?.project || ''}","${leaveTypeLabels[l.leave_type] || l.leave_type}","${l.start_date}","${l.end_date}",${l.days_count},"${(l.reason || '').replace(/"/g, '""')}","${l.status}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leave_report_${dateRange.from}_${dateRange.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Add / Edit / Delete ──
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (leave) => {
    setEditingId(leave.id);
    setForm({
      userId: leave.user_id,
      leaveType: leave.leave_type || 'casual',
      startDate: leave.start_date || '',
      endDate: leave.end_date || '',
      reason: leave.reason || '',
      status: leave.status || 'approved',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.userId || !form.startDate || !form.endDate) {
      alert('Please select an employee and fill in dates.');
      return;
    }
    setSaving(true);
    try {
      const days = calcDays(form.startDate, form.endDate);
      if (editingId) {
        await api.patch(`/leaves/${editingId}`, {
          userId: form.userId,
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          daysCount: days,
          reason: form.reason,
          status: form.status,
        });
      } else {
        await api.post('/leaves', {
          userId: form.userId,
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          daysCount: days,
          reason: form.reason,
          status: form.status,
        });
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Error saving leave: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/leaves/${id}`);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      alert('Error deleting leave: ' + (err?.message || 'Unknown error'));
    }
  };

  const inputClass = "px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all";
  const formInput = "w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[13px] bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all";

  return (
    <div>
      <PageHeader
        icon={Calendar}
        title="Leave Overview"
        subtitle="Organization-wide leave tracker"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-emerald-600/25">
              <Plus size={16} /> Add Leave
            </button>
            <button onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
              <Download size={16} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={Calendar} label="Total Requests" value={filtered.length} color="blue" delay={0.05} />
        <StatCard icon={Clock} label="Pending" value={pendingCount} color="orange" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Approved Days" value={approvedDays} color="green" delay={0.15} />
        <StatCard icon={CalendarOff} label="Rejected" value={rejectedCount} color="rose" delay={0.2} />
      </div>

      {/* View Mode & Date Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-1 bg-slate-50 p-1 rounded-xl">
            {[
              { key: 'month', label: 'Monthly' },
              { key: 'year', label: 'Yearly' },
              { key: 'custom', label: 'Custom Range' },
            ].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-all ${viewMode === v.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {viewMode === 'month' && (
            <div className="flex items-center gap-2">
              <button onClick={() => navMonth(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <ChevronLeft size={16} />
              </button>
              <span className="text-[14px] font-bold text-slate-800 min-w-[140px] text-center">
                {months[selectedMonth]} {selectedYear}
              </span>
              <button onClick={() => navMonth(1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <ChevronRight size={16} />
              </button>
              <div className="flex gap-1 ml-2">
                {months.map((m, i) => (
                  <button key={m} onClick={() => setSelectedMonth(i)}
                    className={`w-8 h-7 rounded-md text-[10px] font-semibold transition-all ${i === selectedMonth ? 'bg-primary-100 text-primary-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                    {m.slice(0, 1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'year' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedYear(y => y - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <ChevronLeft size={16} />
              </button>
              <span className="text-[14px] font-bold text-slate-800 min-w-[60px] text-center">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {viewMode === 'custom' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-500 uppercase">From</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputClass} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-500 uppercase">To</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Filters</span>
        </div>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className={inputClass}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p.replace('VCC - ', '')}</option>)}
        </select>
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className={inputClass}>
          <option value="">All Employees</option>
          {employeeOptions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClass}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputClass}>
          <option value="">All Types</option>
          {Object.entries(leaveTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(projectFilter || employeeFilter || statusFilter || typeFilter) && (
          <button onClick={() => { setProjectFilter(''); setEmployeeFilter(''); setStatusFilter(''); setTypeFilter(''); }}
            className="text-[12px] font-semibold text-primary-600 hover:text-primary-700 transition-colors">
            Clear All
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={CalendarOff} title="No leave records found" description="Try adjusting your date range or filters, or add a new leave record." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Employee</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Project</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Dates</th>
                  <th className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Days</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Reason</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((leave, i) => {
                  const emp = userMap[leave.user_id];
                  return (
                    <motion.tr key={leave.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {(leave.user_name || emp?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-[13px] font-medium text-slate-900">{leave.user_name || emp?.name || leave.user_id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-[12px] text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          {emp?.project?.replace('VCC - ', '') || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-[12px] font-medium text-slate-700">{leaveTypeLabels[leave.leave_type] || leave.leave_type}</span>
                      </td>
                      <td className="py-3.5 px-5 text-[12px] text-slate-600 whitespace-nowrap">
                        {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {leave.start_date !== leave.end_date && ` — ${new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="text-[13px] font-bold text-slate-800 tabular-nums">{leave.days_count}</span>
                      </td>
                      <td className="py-3.5 px-5 text-[12px] text-slate-500 max-w-[250px]">
                        <span className="whitespace-normal break-words line-clamp-2">{leave.reason || '—'}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={leave.status} />
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(leave)} title="Edit"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteConfirm(leave)} title="Delete"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[12px] text-slate-400">
                Showing {filtered.length} of {leaves.length} records
              </span>
              <span className="text-[12px] text-slate-500">
                Total days: <strong className="text-slate-800">{filtered.reduce((s, l) => s + (l.days_count || 0), 0)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Leave' : 'Add Leave'} maxWidth="max-w-lg">
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Employee</label>
            <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className={formInput}
              disabled={!!editingId}>
              <option value="">Select employee...</option>
              {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}{u.project ? ` (${u.project.replace('VCC - ', '')})` : ''}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Leave Type</label>
              <select value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })} className={formInput}>
                {Object.entries(leaveTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={formInput}>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })}
                className={formInput} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
              <input type="date" value={form.endDate} min={form.startDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
                className={formInput} />
            </div>
          </div>

          {form.startDate && form.endDate && (
            <div className="text-[12px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
              Working days: <strong className="text-slate-800">{calcDays(form.startDate, form.endDate)}</strong>
              {' '}(weekends excluded)
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              rows={2} placeholder="Optional reason..."
              className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-[13px] bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.userId || !form.startDate || !form.endDate}
              className="px-5 py-2.5 text-[13px] font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary-600/25 disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update Leave' : 'Add Leave'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Leave Record" maxWidth="max-w-sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-600">
              Are you sure you want to delete the leave record for <strong>{deleteConfirm.user_name || 'this employee'}</strong> ({deleteConfirm.start_date} — {deleteConfirm.end_date})?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)}
                className="px-5 py-2.5 text-[13px] font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-red-600/25">
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
