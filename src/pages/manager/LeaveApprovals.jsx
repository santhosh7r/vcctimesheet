import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarOff, Check, X, Clock, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTimesheets } from '../../context/TimesheetContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

const leaveTypeLabels = {
  casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave',
  unpaid: 'Unpaid Leave', wfh: 'Work from Home', comp_off: 'Comp Off',
};

export default function LeaveApprovals() {
  const { user } = useAuth();
  const { employees: allEmployees } = useTimesheets();
  const employees = useMemo(() =>
    allEmployees.filter(u => u.role === 'employee' && !u.is_archived && u.project === user?.project),
    [allEmployees, user?.project]
  );
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const fetchLeaves = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (user?.project) params.set('project', user.project);
    api.get(`/leaves?${params}`)
      .then(data => setLeaves(data.leaves || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaves();
  }, [user?.project]);

  const handleAction = async () => {
    if (!confirmAction) return;
    await api.put(`/leaves/${confirmAction.id}`, {
      status: confirmAction.action,
      approvedBy: user.id,
    });
    // Send email notification to the employee (CC sysadmin)
    const leave = leaves.find(l => l.id === confirmAction.id);
    if (leave) {
      const emp = employees.find(e => e.id === leave.user_id);
      if (emp?.email) {
        api.post('/email/send-leave-decision', {
          employeeName: leave.user_name || emp.name,
          employeeEmail: emp.email,
          managerName: user.name,
          decision: confirmAction.action,
          leaveType: leave.leave_type,
          startDate: leave.start_date,
          endDate: leave.end_date,
          daysCount: leave.days_count,
          reason: leave.reason,
        }).catch(() => {});
      }
    }
    setConfirmAction(null);
    fetchLeaves();
  };

  const tabs = ['pending', 'approved', 'rejected', 'all'];
  const filteredLeaves = (activeTab === 'all' ? leaves : leaves.filter(l => l.status === activeTab))
    .filter(l => !selectedEmployee || l.user_id === selectedEmployee);

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedThisMonth = leaves.filter(l => {
    if (l.status !== 'approved') return false;
    const d = new Date(l.approved_at || l.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div>
      <PageHeader icon={CalendarOff} title="Leave Approvals" subtitle="Review and manage employee leave requests" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Clock} label="Pending Requests" value={pendingCount} color="orange" delay={0} />
        <StatCard icon={Check} label="Approved This Month" value={approvedThisMonth} color="green" delay={0.05} />
        <StatCard icon={CalendarOff} label="Total Requests" value={leaves.length} color="slate" delay={0.1} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 capitalize ${activeTab === tab ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {tab} {tab === 'pending' && pendingCount > 0 && <span className="ml-1.5 bg-warning-100 text-warning-700 px-1.5 py-0.5 rounded-full text-xs">{pendingCount}</span>}
            </button>
          ))}
        </div>
        <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
          className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
          <option value="">All Employees</option>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card animate delay={0.1}>
        {loading ? (
          <div className="flex justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full"
            />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No leave requests" description={`No ${activeTab === 'all' ? '' : activeTab} leave requests found.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Employee</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Dates</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Days</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Reason</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Status</th>
                  {activeTab === 'pending' && <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-6 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave, i) => {
                  return (
                    <motion.tr key={leave.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[11px] font-semibold">
                            {(leave.user_name || leave.user_id || '?').charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{leave.user_name || leave.user_id}</span>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-sm text-slate-700">{leaveTypeLabels[leave.leave_type] || leave.leave_type}</td>
                      <td className="py-3 px-6 text-sm text-slate-600">
                        {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {leave.start_date !== leave.end_date && ` - ${new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </td>
                      <td className="py-3 px-6 text-sm text-slate-700 tabular-nums">{leave.days_count}</td>
                      <td className="py-3 px-6 text-sm text-slate-600 max-w-[200px] truncate">{leave.reason || '-'}</td>
                      <td className="py-3 px-6">
                        <StatusBadge status={leave.status} />
                      </td>
                      {activeTab === 'pending' && (
                        <td className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setConfirmAction({ id: leave.id, action: 'approved', name: leave.user_name || leave.user_id })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent-700 bg-accent-50 hover:bg-accent-100 rounded-lg transition-colors">
                              <Check size={14} /> Approve
                            </button>
                            <button onClick={() => setConfirmAction({ id: leave.id, action: 'rejected', name: leave.user_name || leave.user_id })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 rounded-lg transition-colors">
                              <X size={14} /> Reject
                            </button>
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirm Action">
        {confirmAction && (
          <div className="text-center">
            <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmAction.action === 'approved' ? 'bg-accent-100' : 'bg-danger-100'}`}>
              {confirmAction.action === 'approved' ? <Check size={24} className="text-accent-600" /> : <X size={24} className="text-danger-600" />}
            </div>
            <p className="text-sm text-slate-700 mb-6">
              Are you sure you want to <strong>{confirmAction.action === 'approved' ? 'approve' : 'reject'}</strong> the leave request from <strong>{confirmAction.name}</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-all shadow-lg ${confirmAction.action === 'approved' ? 'bg-gradient-to-r from-accent-600 to-accent-700 shadow-accent-600/25' : 'bg-gradient-to-r from-danger-600 to-danger-700 shadow-danger-600/25'}`}>
                {confirmAction.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
