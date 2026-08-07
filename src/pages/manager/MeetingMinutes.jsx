import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookPen, Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

export default function MeetingMinutes() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actions, setActions] = useState({});
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [meetingForm, setMeetingForm] = useState({
    title: '', date: new Date().toISOString().split('T')[0], time: '10:00',
    project: '', attendees: [], notes: '',
  });
  const [actionForm, setActionForm] = useState({ description: '', assignedTo: '', dueDate: '' });

  useEffect(() => {
    Promise.all([
      api.get('/meetings'),
      api.get('/users?role=employee'),
    ]).then(([meetData, userData]) => {
      setMeetings(meetData.meetings || []);
      setEmployees(userData.users || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const fetchMeetings = () => {
    const url = projectFilter ? `/meetings?project=${encodeURIComponent(projectFilter)}` : '/meetings';
    api.get(url).then(data => setMeetings(data.meetings || [])).catch(() => {});
  };

  useEffect(() => { if (!loading) fetchMeetings(); }, [projectFilter]);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!actions[id]) {
      const data = await api.get(`/meetings/${id}/actions`).catch(() => ({ actions: [] }));
      setActions(prev => ({ ...prev, [id]: data.actions || [] }));
    }
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.title.trim()) return;
    await api.post('/meetings', {
      ...meetingForm,
      attendees: JSON.stringify(meetingForm.attendees),
      createdBy: user.id,
    });
    setShowMeetingModal(false);
    setMeetingForm({ title: '', date: new Date().toISOString().split('T')[0], time: '10:00', project: '', attendees: [], notes: '' });
    fetchMeetings();
  };

  const handleCreateAction = async () => {
    if (!actionForm.description.trim() || !showActionModal) return;
    await api.post(`/meetings/${showActionModal}/actions`, actionForm);
    const data = await api.get(`/meetings/${showActionModal}/actions`);
    setActions(prev => ({ ...prev, [showActionModal]: data.actions || [] }));
    setShowActionModal(null);
    setActionForm({ description: '', assignedTo: '', dueDate: '' });
  };

  const toggleActionStatus = async (meetingId, actionId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'open' : 'completed';
    await api.put(`/meetings/actions/${actionId}`, { status: newStatus });
    const data = await api.get(`/meetings/${meetingId}/actions`);
    setActions(prev => ({ ...prev, [meetingId]: data.actions || [] }));
  };

  const projects = [...new Set(meetings.map(m => m.project).filter(Boolean))];

  const toggleAttendee = (empId) => {
    setMeetingForm(prev => ({
      ...prev,
      attendees: prev.attendees.includes(empId)
        ? prev.attendees.filter(id => id !== empId)
        : [...prev.attendees, empId],
    }));
  };

  return (
    <div>
      <PageHeader
        icon={NotebookPen}
        title="Meeting Minutes"
        subtitle="Track meetings, notes, and action items"
        actions={
          <button onClick={() => setShowMeetingModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> New Meeting
          </button>
        }
      />

      {/* Filter */}
      <div className="mb-6">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full"
          />
        </div>
      ) : meetings.length === 0 ? (
        <Card animate><EmptyState icon={NotebookPen} title="No meetings yet" description="Create a new meeting to start taking notes." /></Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting, i) => {
            const isExpanded = expandedId === meeting.id;
            const meetingActions = actions[meeting.id] || [];
            const completedActions = meetingActions.filter(a => a.status === 'completed').length;
            let attendeeList = [];
            try { attendeeList = JSON.parse(meeting.attendees || '[]'); } catch {}

            return (
              <motion.div key={meeting.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.005 }}>
                <Card>
                  <div className="cursor-pointer" onClick={() => toggleExpand(meeting.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{meeting.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            {meeting.time && <span>{meeting.time}</span>}
                            {meeting.project && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md">{meeting.project}</span>}
                            {attendeeList.length > 0 && (
                              <span className="inline-flex items-center gap-1"><Users size={12} /> {attendeeList.length}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {meetingActions.length > 0 && (
                        <span className="text-xs text-slate-500">{completedActions}/{meetingActions.length} actions done</span>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          {/* Notes */}
                          {meeting.notes && (
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h4>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-3">{meeting.notes}</p>
                            </div>
                          )}

                          {/* Action Items */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Action Items</h4>
                              <button onClick={(e) => { e.stopPropagation(); setShowActionModal(meeting.id); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                <Plus size={14} /> Add Action
                              </button>
                            </div>
                            {meetingActions.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No action items yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {meetingActions.map(action => (
                                  <div key={action.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                    <button onClick={(e) => { e.stopPropagation(); toggleActionStatus(meeting.id, action.id, action.status); }}
                                      className="mt-0.5 flex-shrink-0">
                                      {action.status === 'completed' ? (
                                        <CheckCircle2 size={18} className="text-accent-500" />
                                      ) : (
                                        <Circle size={18} className="text-slate-300 hover:text-primary-500" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <p className={`text-sm ${action.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {action.description}
                                      </p>
                                      <div className="flex gap-3 mt-1 text-xs text-slate-400">
                                        {action.assigned_to_name && <span>Assigned to: {action.assigned_to_name}</span>}
                                        {action.due_date && <span>Due: {new Date(action.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Meeting Modal */}
      <Modal isOpen={showMeetingModal} onClose={() => setShowMeetingModal(false)} title="New Meeting" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={meetingForm.title} onChange={e => setMeetingForm({ ...meetingForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={meetingForm.date} onChange={e => setMeetingForm({ ...meetingForm, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <input type="time" value={meetingForm.time} onChange={e => setMeetingForm({ ...meetingForm, time: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
              <input type="text" value={meetingForm.project} onChange={e => setMeetingForm({ ...meetingForm, project: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Attendees</label>
            <div className="border-2 border-slate-200 rounded-xl p-2 max-h-32 overflow-y-auto">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={meetingForm.attendees.includes(emp.id)}
                    onChange={() => toggleAttendee(emp.id)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-slate-700">{emp.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={meetingForm.notes} onChange={e => setMeetingForm({ ...meetingForm, notes: e.target.value })} rows={4}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowMeetingModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleCreateMeeting} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl transition-all shadow-lg shadow-primary-600/25">Create Meeting</button>
          </div>
        </div>
      </Modal>

      {/* Add Action Modal */}
      <Modal isOpen={!!showActionModal} onClose={() => setShowActionModal(null)} title="Add Action Item" maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={actionForm.description} onChange={e => setActionForm({ ...actionForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
            <select value={actionForm.assignedTo} onChange={e => setActionForm({ ...actionForm, assignedTo: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
              <option value="">Unassigned</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input type="date" value={actionForm.dueDate} onChange={e => setActionForm({ ...actionForm, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowActionModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleCreateAction} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl transition-all shadow-lg shadow-primary-600/25">Add Action</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
