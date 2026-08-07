import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, Users,
  Send, RefreshCw, FileText, AlertTriangle, Sparkles, Mail, X, Loader2,
  ClipboardPaste, Calendar,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const statusConfig = {
  pending: { label: 'Pending', bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock },
  no_transcript: { label: 'No Transcript', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  transcript_ready: { label: 'Ready', bg: 'bg-blue-100', text: 'text-blue-700', icon: FileText },
  processing: { label: 'Processing', bg: 'bg-purple-100', text: 'text-purple-700', icon: Loader2 },
  completed: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
  failed: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
};

export default function MeetingNotesAI() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedActions, setExpandedActions] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '', meetingDate: new Date().toISOString().slice(0, 16),
    attendees: '', transcript: '',
  });

  useEffect(() => {
    fetchNotes();
  }, [statusFilter]);

  const fetchNotes = () => {
    const url = statusFilter ? `/meeting-notes?status=${statusFilter}` : '/meeting-notes';
    api.get(url).then(data => setNotes(data.notes || [])).catch(() => {}).finally(() => setLoading(false));
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    const attendees = createForm.attendees
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)
      .map(email => ({ email, name: email.split('@')[0] }));

    await api.post('/meeting-notes', {
      title: createForm.title,
      meetingDate: new Date(createForm.meetingDate).toISOString(),
      attendees,
      transcript: createForm.transcript || null,
    });
    setShowCreateModal(false);
    setCreateForm({ title: '', meetingDate: new Date().toISOString().slice(0, 16), attendees: '', transcript: '' });
    fetchNotes();
  };

  const handlePasteTranscript = async () => {
    if (!showTranscriptModal || !transcriptText.trim()) return;
    await api.put(`/meeting-notes/${showTranscriptModal}`, { transcript: transcriptText });
    setShowTranscriptModal(null);
    setTranscriptText('');
    fetchNotes();
  };

  const handleProcess = async (noteId) => {
    setProcessingId(noteId);
    try {
      const resp = await fetch('/api/meetings/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      fetchNotes();
    } catch (err) {
      alert(`Processing failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedActions[id]) {
      const data = await api.get(`/meeting-notes/${id}/actions`).catch(() => ({ actions: [] }));
      setExpandedActions(prev => ({ ...prev, [id]: data.actions || [] }));
    }
  };

  const toggleActionStatus = async (noteId, actionId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'open' : 'completed';
    await api.put(`/meeting-notes/actions/${actionId}`, { status: newStatus });
    const data = await api.get(`/meeting-notes/${noteId}/actions`);
    setExpandedActions(prev => ({ ...prev, [noteId]: data.actions || [] }));
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this meeting note?')) return;
    await api.del(`/meeting-notes/${id}`);
    fetchNotes();
  };

  // Stats
  const totalNotes = notes.length;
  const completedNotes = notes.filter(n => n.status === 'completed').length;
  const pendingTranscripts = notes.filter(n => n.status === 'no_transcript' || n.status === 'pending').length;
  const totalActions = notes.reduce((sum, n) => {
    try { return sum + (JSON.parse(n.action_items || '[]')).length; } catch { return sum; }
  }, 0);

  const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all";

  return (
    <div>
      <PageHeader
        icon={Bot}
        title="AI Meeting Notes"
        subtitle="Auto-detect meetings, generate minutes & action items with AI"
        actions={
          <div className="flex gap-2">
            <button onClick={fetchNotes}
              className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
              <Plus size={16} /> Add Meeting
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Meetings', value: totalNotes, icon: Calendar, color: 'slate' },
          { label: 'AI Processed', value: completedNotes, icon: Sparkles, color: 'emerald' },
          { label: 'Awaiting Transcript', value: pendingTranscripts, icon: ClipboardPaste, color: 'amber' },
          { label: 'Action Items', value: totalActions, icon: CheckCircle2, color: 'blue' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-${stat.color}-100 flex items-center justify-center`}>
                <stat.icon size={17} className={`text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                <p className="text-[11px] text-slate-400 font-medium">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-6">
        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] w-fit">
          {[
            { value: '', label: 'All' },
            { value: 'completed', label: 'Processed' },
            { value: 'no_transcript', label: 'Needs Transcript' },
            { value: 'pending', label: 'Pending' },
            { value: 'failed', label: 'Failed' },
          ].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === f.value ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : notes.length === 0 ? (
        <Card animate><EmptyState icon={Bot} title="No AI meeting notes yet" description="Meetings where sysadmin is CC'd will auto-appear here, or add one manually." /></Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note, i) => {
            const isExpanded = expandedId === note.id;
            const config = statusConfig[note.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const noteActions = expandedActions[note.id] || [];
            let attendeeList = [];
            try { attendeeList = JSON.parse(note.attendees || '[]'); } catch {}
            let actionItems = [];
            try { actionItems = JSON.parse(note.action_items || '[]'); } catch {}
            const completedActions = noteActions.filter(a => a.status === 'completed').length;

            return (
              <motion.div key={note.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}>
                <Card>
                  <div className="cursor-pointer" onClick={() => toggleExpand(note.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{note.title}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${config.bg} ${config.text}`}>
                              <StatusIcon size={10} /> {config.label}
                            </span>
                            {note.email_sent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                                <Mail size={10} /> Emailed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{new Date(note.meeting_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {note.organizer && <span>by {note.organizer.split('@')[0]}</span>}
                            {attendeeList.length > 0 && (
                              <span className="inline-flex items-center gap-1"><Users size={12} /> {attendeeList.length}</span>
                            )}
                            {actionItems.length > 0 && (
                              <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> {actionItems.length} actions</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {(note.status === 'no_transcript' || note.status === 'pending') && (
                          <button onClick={() => { setShowTranscriptModal(note.id); setTranscriptText(note.transcript_text || ''); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <ClipboardPaste size={14} /> Paste Transcript
                          </button>
                        )}
                        {(note.status === 'transcript_ready' || note.status === 'failed') && (
                          <button onClick={() => handleProcess(note.id)} disabled={processingId === note.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50">
                            {processingId === note.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {processingId === note.id ? 'Processing...' : 'Process with AI'}
                          </button>
                        )}
                        <button onClick={() => handleDelete(note.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                          {/* Summary */}
                          {note.summary && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Sparkles size={12} /> AI Summary
                              </h4>
                              <p className="text-sm text-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 leading-relaxed">{note.summary}</p>
                            </div>
                          )}

                          {/* Minutes */}
                          {note.minutes_html && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Minutes</h4>
                              <div className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: note.minutes_html }} />
                            </div>
                          )}

                          {/* Key Decisions */}
                          {(() => {
                            let decisions = [];
                            try { decisions = JSON.parse(note.key_decisions || '[]'); } catch {}
                            if (decisions.length === 0) return null;
                            return (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Decisions</h4>
                                <div className="space-y-2">
                                  {decisions.map((d, idx) => (
                                    <div key={idx} className="flex gap-2 text-sm">
                                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold mt-0.5">{idx + 1}</span>
                                      <div>
                                        <p className="font-medium text-slate-800">{d.decision}</p>
                                        {d.context && <p className="text-slate-500 text-xs mt-0.5">{d.context}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Action Items (from normalized table) */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Action Items</h4>
                              {noteActions.length > 0 && (
                                <span className="text-xs text-slate-500">{completedActions}/{noteActions.length} done</span>
                              )}
                            </div>
                            {noteActions.length === 0 && actionItems.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No action items.</p>
                            ) : (
                              <div className="space-y-2">
                                {(noteActions.length > 0 ? noteActions : actionItems.map((a, idx) => ({
                                  id: idx, task: a.task, assignee: a.assignee, due_date: a.due_date, status: 'open',
                                }))).map(action => (
                                  <div key={action.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                                    <button onClick={(e) => { e.stopPropagation(); if (noteActions.length > 0) toggleActionStatus(note.id, action.id, action.status); }}
                                      className="mt-0.5 flex-shrink-0">
                                      {action.status === 'completed' ? (
                                        <CheckCircle2 size={18} className="text-emerald-500" />
                                      ) : (
                                        <Circle size={18} className="text-slate-300 hover:text-primary-500 transition-colors" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <p className={`text-sm ${action.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {action.task}
                                      </p>
                                      <div className="flex gap-3 mt-1 text-xs text-slate-400">
                                        {action.assignee && <span>Assigned: {action.assignee}</span>}
                                        {action.due_date && <span>Due: {new Date(action.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Error */}
                          {note.error_message && (
                            <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600">
                              <span className="font-semibold">Error:</span> {note.error_message}
                            </div>
                          )}

                          {/* Transcript preview */}
                          {note.transcript_text && (
                            <details className="group">
                              <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 transition-colors">
                                Raw Transcript ({note.transcript_source})
                              </summary>
                              <pre className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-4 max-h-48 overflow-y-auto whitespace-pre-wrap">{note.transcript_text.substring(0, 5000)}</pre>
                            </details>
                          )}
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

      {/* Create Meeting Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Meeting for AI Notes" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Title *</label>
            <input type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g. Sprint Planning - Week 18" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time</label>
            <input type="datetime-local" value={createForm.meetingDate} onChange={e => setCreateForm({ ...createForm, meetingDate: e.target.value })}
              className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Attendee Emails (comma-separated)</label>
            <input type="text" value={createForm.attendees} onChange={e => setCreateForm({ ...createForm, attendees: e.target.value })}
              placeholder="john@d4insight.com, jane@d4insight.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transcript (optional — paste now or later)</label>
            <textarea value={createForm.transcript} onChange={e => setCreateForm({ ...createForm, transcript: e.target.value })}
              rows={6} placeholder="Paste meeting transcript here for AI processing..." className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25">
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Paste Transcript Modal */}
      <Modal isOpen={!!showTranscriptModal} onClose={() => setShowTranscriptModal(null)} title="Paste Meeting Transcript" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Paste the meeting transcript below. After saving, click "Process with AI" to generate minutes and action items.</p>
          <textarea value={transcriptText} onChange={e => setTranscriptText(e.target.value)}
            rows={12} placeholder="Paste full meeting transcript here..." className={inputClass} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowTranscriptModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handlePasteTranscript}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25">
              Save Transcript
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
