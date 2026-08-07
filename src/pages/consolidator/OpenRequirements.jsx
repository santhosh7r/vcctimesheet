import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plus, Pencil, Trash2, MapPin, Users, Upload, FileText, User } from 'lucide-react';
import { api, supabase, useSupabase } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';

const locationConfig = {
  onsite: { color: 'bg-accent-100 text-accent-700', label: 'On-site' },
  offshore: { color: 'bg-primary-100 text-primary-700', label: 'Offshore' },
  hybrid: { color: 'bg-purple-100 text-purple-700', label: 'Hybrid' },
};

const statusTabs = ['all', 'open', 'on_hold', 'closed'];

const emptyForm = {
  title: '', description: '', project: '', locationType: 'onsite',
  locationDetail: '', positionsCount: 1, skills: '', priority: 'medium',
  requestedBy: '',
};

export default function OpenRequirements() {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [jdFile, setJdFile] = useState(null);

  const fetchReqs = () => {
    api.get('/requirements').then(data => setRequirements(data.requirements || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchReqs(); }, []);

  const filtered = (activeTab === 'all' ? requirements : requirements.filter(r => r.status === activeTab))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const openCount = requirements.filter(r => r.status === 'open').length;
  const totalPositions = requirements.filter(r => r.status === 'open').reduce((s, r) => s + (r.positions_count || 0), 0);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    if (editId) {
      await api.put(`/requirements/${editId}`, {
        title: form.title,
        description: form.description,
        project: form.project,
        location_type: form.locationType,
        location_detail: form.locationDetail,
        positions_count: form.positionsCount || 1,
        skills: form.skills,
        priority: form.priority || 'medium',
        requested_by: form.requestedBy,
      });
    } else {
      const result = await api.post('/requirements', { ...form, createdBy: user.id });
      // Upload JD file if attached
      if (jdFile && result?.id && useSupabase && supabase) {
        const storagePath = `requirements/${result.id}/${Date.now()}_${jdFile.name}`;
        await supabase.storage.from('documents').upload(storagePath, jdFile, { contentType: jdFile.type });
        await api.put(`/requirements/${result.id}`, { jd_file: storagePath, jd_filename: jdFile.name });
      }
    }
    setShowModal(false);
    setEditId(null);
    setForm({ ...emptyForm });
    setJdFile(null);
    fetchReqs();
  };

  const openEdit = (req) => {
    setEditId(req.id);
    setForm({
      title: req.title, description: req.description || '', project: req.project || '',
      locationType: req.location_type || 'onsite', locationDetail: req.location_detail || '',
      positionsCount: req.positions_count || 1, skills: req.skills || '', priority: req.priority || 'medium',
      requestedBy: req.requested_by || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this requirement?')) return;
    await api.del(`/requirements/${id}`);
    fetchReqs();
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/requirements/${id}`, { status });
    fetchReqs();
  };

  const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500";

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        title="Open Requirements"
        subtitle="Manage hiring positions and job openings"
        actions={
          <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> New Requirement
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Briefcase} label="Open Positions" value={openCount} color="blue" delay={0.05} />
        <StatCard icon={Users} label="Total Headcount" value={totalPositions} color="green" delay={0.1} />
        <StatCard icon={Briefcase} label="Total Requirements" value={requirements.length} color="slate" delay={0.15} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white p-1 rounded-xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] w-fit">
        {statusTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <EmptyState icon={Briefcase} title="No requirements" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req, i) => {
            const loc = locationConfig[req.location_type] || locationConfig.onsite;
            const skills = req.skills ? req.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
            return (
              <motion.div key={req.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.005 }}>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">{req.title}</h3>
                      {req.description && <p className="text-xs text-slate-500 mt-1">{req.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${loc.color}`}>
                          <MapPin size={12} /> {loc.label}
                        </span>
                        {req.project && <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">{req.project}</span>}
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Users size={12} /> {req.positions_count}</span>
                        <select value={req.status} onChange={e => handleStatusChange(req.id, e.target.value)}
                          className="text-xs border-2 border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
                          <option value="open">Open</option>
                          <option value="on_hold">On Hold</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {skills.map(s => <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs">{s}</span>)}
                        </div>
                      )}
                      {req.requested_by && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                          <User size={12} className="text-slate-400" />
                          <span className="font-medium">From:</span> {req.requested_by}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button onClick={() => openEdit(req)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(req.id)} className="p-1.5 text-slate-400 hover:text-danger-500 rounded-lg hover:bg-danger-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditId(null); }} title={editId ? 'Edit Requirement' : 'New Requirement'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
              <input type="text" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location Type</label>
              <select value={form.locationType} onChange={e => setForm({ ...form, locationType: e.target.value })} className={inputClass}>
                <option value="onsite">On-site</option>
                <option value="offshore">Offshore</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Positions</label>
              <input type="number" min="1" value={form.positionsCount} onChange={e => setForm({ ...form, positionsCount: parseInt(e.target.value) || 1 })} className={inputClass} />
            </div>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Location Detail</label>
              <input type="text" value={form.locationDetail} onChange={e => setForm({ ...form, locationDetail: e.target.value })} className={inputClass} placeholder="e.g. Chennai" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma-separated)</label>
              <input type="text" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} className={inputClass} placeholder="React, Node.js, AWS" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Requested By</label>
              <input type="text" value={form.requestedBy} onChange={e => setForm({ ...form, requestedBy: e.target.value })} className={inputClass} placeholder="Name or email" />
            </div>
          </div>
          {!editId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Description (optional)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:border-primary-400 transition-colors">
                {jdFile ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-700"><FileText size={16} /> {jdFile.name}</span>
                    <button onClick={() => setJdFile(null)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Upload size={16} /> Upload JD (.pdf, .docx)
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={e => setJdFile(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditId(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25">{editId ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
