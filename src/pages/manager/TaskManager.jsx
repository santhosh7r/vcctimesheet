import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, Plus, Search, CheckCircle2, Clock, AlertTriangle, Ban, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTimesheets } from '../../context/TimesheetContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';

const priorityConfig = {
  low: { color: 'bg-slate-100 text-slate-700', label: 'Low' },
  medium: { color: 'bg-primary-100 text-primary-700', label: 'Medium' },
  high: { color: 'bg-warning-100 text-warning-700', label: 'High' },
  urgent: { color: 'bg-danger-100 text-danger-700', label: 'Urgent' },
};

const statusConfig = {
  pending: { color: 'bg-slate-100 text-slate-700', icon: Clock, label: 'Pending' },
  in_progress: { color: 'bg-primary-100 text-primary-700', icon: ChevronRight, label: 'In Progress' },
  completed: { color: 'bg-accent-100 text-accent-700', icon: CheckCircle2, label: 'Completed' },
  blocked: { color: 'bg-danger-100 text-danger-700', icon: Ban, label: 'Blocked' },
};

export default function TaskManager() {
  const { user } = useAuth();
  const { employees: allEmployees } = useTimesheets();
  const employees = useMemo(() =>
    allEmployees.filter(u => u.role === 'employee' && !u.is_archived && u.project === user?.project),
    [allEmployees, user?.project]
  );
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', estimatedHours: '' });

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(employees[0]);
    }
  }, [employees, selectedEmployee]);

  const fetchTasks = useCallback(() => {
    if (!selectedEmployee) return;
    setLoading(true);
    api.get(`/tasks?userId=${selectedEmployee.id}&date=${selectedDate}`)
      .then(data => setTasks(data.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [selectedEmployee, selectedDate]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await api.post('/tasks', {
      userId: selectedEmployee.id,
      assignedBy: user.id,
      assignedToName: selectedEmployee.name,
      title: form.title,
      description: form.description,
      date: selectedDate,
      priority: form.priority,
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
    });
    // Send email notification to the employee
    if (selectedEmployee.email) {
      api.post('/email/send-task-notification', {
        employeeEmail: selectedEmployee.email,
        employeeName: selectedEmployee.name,
        managerName: user.name,
        taskTitle: form.title,
        taskDescription: form.description,
        taskDate: selectedDate,
        taskPriority: form.priority,
        estimatedHours: form.estimatedHours || null,
      }).catch(() => {}); // don't block on email failure
    }
    setForm({ title: '', description: '', priority: 'medium', estimatedHours: '' });
    setShowModal(false);
    fetchTasks();
  };

  const handleStatusChange = async (taskId, status) => {
    await api.put(`/tasks/${taskId}`, { status });
    fetchTasks();
  };

  const handleDelete = async (taskId) => {
    await api.del(`/tasks/${taskId}`);
    fetchTasks();
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.id.includes(search)
  );

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  };

  return (
    <div>
      <PageHeader
        icon={ListChecks}
        title="Task Manager"
        subtitle="Assign and manage daily tasks for your team"
        actions={
          <button onClick={() => setShowModal(true)} disabled={!selectedEmployee}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 shadow-lg shadow-primary-600/25">
            <Plus size={16} /> Add Task
          </button>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Employee List */}
        <div className="col-span-4">
          <Card animate delay={0.1}>
            <div className="mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
              </div>
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredEmployees.map(emp => (
                <button key={emp.id} onClick={() => setSelectedEmployee(emp)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${selectedEmployee?.id === emp.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{emp.name}</div>
                      <div className="text-xs text-slate-500">{emp.id} &middot; {emp.project}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Tasks Panel */}
        <div className="col-span-8">
          <div className="mb-4 flex items-center gap-4">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            {selectedEmployee && (
              <span className="text-sm text-slate-600">Tasks for <strong>{selectedEmployee.name}</strong></span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard icon={ListChecks} label="Total" value={stats.total} color="slate" delay={0.1} />
            <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="green" delay={0.15} />
            <StatCard icon={Clock} label="In Progress" value={stats.inProgress} color="blue" delay={0.2} />
            <StatCard icon={AlertTriangle} label="Blocked" value={stats.blocked} color="rose" delay={0.25} />
          </div>

          {/* Task List */}
          <Card animate delay={0.2}>
            {loading ? (
              <div className="flex justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full"
                />
              </div>
            ) : tasks.length === 0 ? (
              <EmptyState icon={ListChecks} title="No tasks for this date" description="Click 'Add Task' to assign a new task." />
            ) : (
              <div className="space-y-3">
                {tasks.map((task, i) => {
                  const sc = statusConfig[task.status] || statusConfig.pending;
                  const pc = priorityConfig[task.priority] || priorityConfig.medium;
                  return (
                    <motion.div key={task.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={{ scale: 1.005 }}
                      className="border border-slate-200/60 rounded-2xl p-4 hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                          {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${sc.color}`}>
                              <sc.icon size={12} /> {sc.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${pc.color}`}>{pc.label}</span>
                            {task.estimated_hours && <span className="text-xs text-slate-400">{task.estimated_hours}h est.</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <select value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)}
                            className="text-xs border-2 border-slate-200 rounded-xl px-2 py-1 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="blocked">Blocked</option>
                          </select>
                          <button onClick={() => handleDelete(task.id)} className="p-1.5 text-slate-400 hover:text-danger-500 rounded-lg hover:bg-danger-50 transition-colors">
                            <Ban size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Task Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Task">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" placeholder="Task title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" placeholder="Task description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Hours</label>
              <input type="number" step="0.5" value={form.estimatedHours} onChange={e => setForm({ ...form, estimatedHours: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" placeholder="e.g. 4" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleCreate} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl transition-all shadow-lg shadow-primary-600/25">Create Task</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
