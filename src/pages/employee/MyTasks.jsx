import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, CheckCircle2, AlertTriangle, Ban, ChevronRight, ListChecks, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';

const statusConfig = {
  pending: { color: 'bg-slate-100 text-slate-600', icon: Clock, label: 'Pending' },
  in_progress: { color: 'bg-blue-50 text-blue-600', icon: ChevronRight, label: 'In Progress' },
  completed: { color: 'bg-accent-50 text-accent-700', icon: CheckCircle2, label: 'Completed' },
  blocked: { color: 'bg-danger-50 text-danger-600', icon: Ban, label: 'Blocked' },
};

const priorityConfig = {
  low: 'bg-slate-50 text-slate-600 ring-slate-200',
  medium: 'bg-blue-50 text-blue-600 ring-blue-200',
  high: 'bg-warning-50 text-warning-600 ring-warning-200',
  urgent: 'bg-danger-50 text-danger-600 ring-danger-200',
};

const emptyTask = {
  title: '', description: '', priority: 'medium', date: new Date().toISOString().split('T')[0],
  estimated_hours: '',
};

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyTask });

  const fetchTasks = () => {
    setLoading(true);
    let url = `/tasks?userId=${user.id}`;
    if (selectedDate) url += `&date=${selectedDate}`;
    api.get(url)
      .then(data => setTasks(data.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, [user.id, selectedDate]);

  const handleStatusChange = async (taskId, status) => {
    await api.put(`/tasks/${taskId}`, { status });
    fetchTasks();
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      date: form.date,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
    };
    if (editId) {
      await api.put(`/tasks/${editId}`, payload);
    } else {
      await api.post('/tasks', { ...payload, userId: user.id, assignedTo: user.id, assignedToName: user.name, status: 'pending' });
    }
    setShowModal(false);
    setEditId(null);
    setForm({ ...emptyTask });
    fetchTasks();
  };

  const openEdit = (task) => {
    setEditId(task.id);
    setForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      date: task.date || new Date().toISOString().split('T')[0],
      estimated_hours: task.estimated_hours || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await api.del(`/tasks/${id}`);
    fetchTasks();
  };

  const tabs = ['all', 'pending', 'in_progress', 'completed', 'blocked'];
  const filteredTasks = activeTab === 'all' ? tasks : tasks.filter(t => t.status === activeTab);

  const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500";

  return (
    <div>
      <PageHeader title="My Tasks" subtitle="View and manage your tasks" icon={ListChecks}
        actions={
          <button onClick={() => { setEditId(null); setForm({ ...emptyTask }); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> Add Task
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard icon={CheckSquare} label="Total Tasks" value={tasks.length} color="slate" delay={0} />
        <StatCard icon={Clock} label="In Progress" value={tasks.filter(t => t.status === 'in_progress').length} color="blue" delay={0.06} />
        <StatCard icon={CheckCircle2} label="Completed" value={tasks.filter(t => t.status === 'completed').length} color="green" delay={0.12} />
        <StatCard icon={AlertTriangle} label="Blocked" value={tasks.filter(t => t.status === 'blocked').length} color="rose" delay={0.18} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 bg-white p-1.5 rounded-xl border border-slate-200/60 shadow-sm">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-all duration-200 capitalize ${
                activeTab === tab
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="px-4 py-2 text-[12px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
        {selectedDate && (
          <button onClick={() => setSelectedDate('')} className="text-[12px] font-semibold text-primary-600 hover:text-primary-700 transition-colors">Clear</button>
        )}
      </div>

      {/* Task List */}
      <Card animate delay={0.1}>
        {loading ? (
          <div className="flex justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks found" description="Click 'Add Task' to create your first task." />
        ) : (
          <div className="p-4 space-y-3">
            {filteredTasks.map((task, i) => {
              const sc = statusConfig[task.status] || statusConfig.pending;
              const pc = priorityConfig[task.priority] || priorityConfig.medium;
              const isSelfCreated = task.created_by === user.id || task.assigned_to === user.id;
              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.005 }}
                  className="border border-slate-200/60 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-200 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-[14px] font-bold text-slate-900">{task.title}</h4>
                      {task.description && <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{task.description}</p>}
                      <div className="flex items-center gap-2.5 mt-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${sc.color}`}>
                          <sc.icon size={12} /> {sc.label}
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ring-1 ring-inset ${pc}`}>{task.priority}</span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {task.estimated_hours && <span className="text-[11px] text-slate-400">{task.estimated_hours}h est.</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <select value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)}
                        className="text-[12px] font-medium border-2 border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                      </select>
                      {isSelfCreated && (
                        <>
                          <button onClick={() => openEdit(task)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(task.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Task Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditId(null); }} title={editId ? 'Edit Task' : 'Add Task'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Task title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} placeholder="Task details..." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Est. Hours</label>
              <input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: e.target.value })} className={inputClass} placeholder="e.g. 4" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditId(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25">{editId ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
