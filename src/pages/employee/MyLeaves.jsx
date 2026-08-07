import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarOff, Plus, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';

const leaveTypes = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'earned', label: 'Earned Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'wfh', label: 'Work from Home' },
  { value: 'comp_off', label: 'Comp Off' },
];

const balanceColors = [
  { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', bar: 'bg-blue-500' },
  { gradient: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', bar: 'bg-rose-500' },
  { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
];

export default function MyLeaves() {
  const { user } = useAuth();
  const [balances, setBalances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leaveType: 'casual', startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/leaves/balances/${user.id}`),
      api.get(`/leaves?userId=${user.id}`),
    ]).then(([balData, leaveData]) => {
      setBalances(balData.balances || []);
      setLeaves(leaveData.leaves || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [user.id]);

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate) return;
    setSubmitting(true);
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
    try {
      await api.post('/leaves', {
        userId: user.id, leaveType: form.leaveType, startDate: form.startDate,
        endDate: form.endDate, daysCount: days, reason: form.reason,
      });
      // Send email notification to manager (CC sysadmin)
      if (user.project) {
        api.get(`/users?role=manager&project=${encodeURIComponent(user.project)}`).then(data => {
          const manager = data.users?.[0];
          if (manager?.email) {
            api.post('/email/send-leave-request', {
              employeeName: user.name,
              employeeEmail: user.email,
              managerEmail: manager.email,
              leaveType: form.leaveType,
              startDate: form.startDate,
              endDate: form.endDate,
              daysCount: days,
              reason: form.reason,
            }).catch(() => {});
          }
        }).catch(() => {});
      }
      setShowModal(false);
      setForm({ leaveType: 'casual', startDate: '', endDate: '', reason: '' });
      fetchData();
    } catch {}
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Leaves"
        subtitle="View leave balance and request time off"
        icon={CalendarOff}
        actions={
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-[13px] font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> Request Leave
          </button>
        }
      />

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {['casual', 'sick', 'earned'].map((type, i) => {
          const bal = balances.find(b => b.leave_type === type);
          const total = bal?.total_days || 0;
          const used = bal?.used_days || 0;
          const remaining = total - used;
          const pct = total > 0 ? (used / total) * 100 : 0;
          const label = leaveTypes.find(t => t.value === type)?.label || type;
          const colors = balanceColors[i];
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
                  <p className="text-[28px] font-bold text-slate-900 tabular-nums leading-tight mt-1">
                    {remaining}
                    <span className="text-[14px] font-normal text-slate-400 ml-1">/ {total}</span>
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${colors.bg} text-slate-600`}>
                  {used} used
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                  className={`h-full rounded-full ${pct > 80 ? 'bg-danger-500' : pct > 50 ? 'bg-warning-500' : colors.bar}`} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Leave History */}
      <Card animate delay={0.2}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-800">Leave History</h3>
        </div>
        {leaves.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No leave records" description="Your leave requests will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Dates</th>
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Days</th>
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reason</th>
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave, i) => (
                  <motion.tr key={leave.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                    <td className="py-3.5 px-6 text-[13px] font-medium text-slate-700">{leaveTypes.find(t => t.value === leave.leave_type)?.label || leave.leave_type}</td>
                    <td className="py-3.5 px-6 text-[12px] text-slate-500">
                      {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {leave.start_date !== leave.end_date && ` \u2014 ${new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </td>
                    <td className="py-3.5 px-6 text-[13px] font-bold text-slate-700 tabular-nums">{leave.days_count}</td>
                    <td className="py-3.5 px-6 text-[12px] text-slate-500 max-w-[200px] truncate">{leave.reason || '\u2014'}</td>
                    <td className="py-3.5 px-6"><StatusBadge status={leave.status} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Request Leave Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Request Leave">
        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">Leave Type</label>
            <select value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })}
              className="w-full px-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
              {leaveTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">Reason</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3}
              className="w-full px-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all resize-none" placeholder="Optional reason for leave" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all border-2 border-slate-200">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting || !form.startDate || !form.endDate}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-primary-600/25">
              <Send size={14} /> Submit Request
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
