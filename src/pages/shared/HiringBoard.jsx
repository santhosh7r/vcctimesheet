import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, Search, Users, Pencil, Trash2, Plus, X, User, Gift, Send, Upload, FileText } from 'lucide-react';
import { api, supabase, useSupabase, getFileUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';

const locationConfig = {
  onsite: { gradient: 'from-emerald-500 to-teal-500', label: 'On-site' },
  offshore: { gradient: 'from-blue-500 to-indigo-500', label: 'Offshore' },
  hybrid: { gradient: 'from-violet-500 to-purple-500', label: 'Hybrid' },
};

const priorityConfig = {
  low: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
  medium: 'bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-200',
  high: 'bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-200',
  urgent: 'bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-200',
};

const referralStatusConfig = {
  submitted: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200',
  screening: 'bg-purple-50 text-purple-600 ring-1 ring-inset ring-purple-200',
  interview: 'bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-200',
  selected: 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200',
  rejected: 'bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-200',
  joined: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
};

const emptyForm = {
  title: '', description: '', project: '', locationType: 'onsite',
  locationDetail: '', positionsCount: 1, skills: '', priority: 'medium',
  requestedBy: '',
};

const emptyReferral = {
  candidateName: '', candidateEmail: '', candidatePhone: '',
  requirementId: '', resume: '', notes: '',
};

export default function HiringBoard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralForm, setReferralForm] = useState({ ...emptyReferral });
  const [referrals, setReferrals] = useState([]);
  const [resumeFile, setResumeFile] = useState(null);
  const [refResumeUploadingId, setRefResumeUploadingId] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [detailTab, setDetailTab] = useState('details');

  const fetchReqs = () => {
    api.get('/requirements')
      .then(data => setRequirements(data.requirements || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchReferrals = () => {
    api.get('/referrals')
      .then(data => setReferrals(data.referrals || []))
      .catch(() => setReferrals([]));
  };

  useEffect(() => { fetchReqs(); fetchReferrals(); }, []);

  // Referral count per requirement
  const referralCountMap = useMemo(() => {
    const map = {};
    for (const ref of referrals) {
      const rid = ref.requirement_id;
      if (rid) map[rid] = (map[rid] || 0) + 1;
    }
    return map;
  }, [referrals]);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    let reqId = editId;
    if (editId) {
      await api.put(`/requirements/${editId}`, {
        title: form.title, description: form.description, project: form.project,
        location_type: form.locationType, location_detail: form.locationDetail,
        positions_count: form.positionsCount || 1, skills: form.skills, priority: form.priority,
        requested_by: form.requestedBy,
      });
    } else {
      const result = await api.post('/requirements', { ...form, createdBy: user?.id || 'ADM001' });
      reqId = result?.id;
    }
    // Upload JD file if provided
    if (jdFile && reqId) {
      try {
        if (useSupabase && supabase) {
          const storagePath = `requirements/${reqId}/${Date.now()}_${jdFile.name}`;
          await supabase.storage.from('documents').upload(storagePath, jdFile, { contentType: jdFile.type });
          await api.put(`/requirements/${reqId}`, { jd_file: storagePath, jd_filename: jdFile.name });
        }
      } catch (e) { console.error('JD upload failed:', e); }
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

  // Open a stored document (resume / JD) via a freshly-minted signed URL.
  const openStoredFile = async (path) => {
    if (!path) return;
    const url = await getFileUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  // Attach / replace a resume on an existing referral (e.g. referrals created
  // before resume upload worked, which show "No resume").
  const handleReferralResumeUpload = async (ref, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!supabase) { alert('File storage is not available in this environment.'); return; }
    setRefResumeUploadingId(ref.id);
    try {
      const storagePath = `referrals/${ref.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('documents').upload(storagePath, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      await api.put(`/referrals/${ref.id}`, { resume_file: storagePath, resume_filename: file.name });
      fetchReferrals();
    } catch (err) {
      alert('Resume upload failed: ' + (err?.message || 'unknown error'));
    } finally {
      setRefResumeUploadingId(null);
    }
  };

  const handleReferralSubmit = async () => {
    if (!referralForm.candidateName.trim() || !referralForm.requirementId) return;
    const result = await api.post('/referrals', {
      ...referralForm,
      referredBy: user?.id,
      referredByName: user?.name,
    });
    if (resumeFile && result?.id) {
      try {
        if (useSupabase && supabase) {
          const storagePath = `referrals/${result.id}/${Date.now()}_${resumeFile.name}`;
          await supabase.storage.from('documents').upload(storagePath, resumeFile, { contentType: resumeFile.type });
          await api.put(`/referrals/${result.id}`, { resume_file: storagePath, resume_filename: resumeFile.name });
        }
      } catch (e) { console.error('Resume upload failed:', e); }
    }
    setShowReferralModal(false);
    setReferralForm({ ...emptyReferral });
    setResumeFile(null);
    fetchReferrals();
  };

  const projects = [...new Set(requirements.map(r => r.project).filter(Boolean))];
  const [statusFilter, setStatusFilter] = useState('open');

  const filtered = requirements.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter && r.project !== projectFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Stats
  const openCount = requirements.filter(r => r.status === 'open').length;
  const totalPositions = requirements.filter(r => r.status === 'open').reduce((s, r) => s + (r.positions_count || 0), 0);
  const totalReferrals = referrals.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  // Get referrals for a specific requirement
  const getReqReferrals = (reqId) => referrals.filter(r => r.requirement_id === reqId);

  return (
    <div>
      <PageHeader title="Hiring Board" subtitle="Open positions and referrals" icon={Briefcase}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => { setReferralForm({ ...emptyReferral }); setResumeFile(null); setShowReferralModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-accent-500/25">
              <Gift size={16} /> Refer Candidate
            </button>
            {isAdmin && (
              <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setJdFile(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
                <Plus size={16} /> New Requirement
              </button>
            )}
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Briefcase} label="Open Positions" value={openCount} color="blue" delay={0.05} />
        <StatCard icon={Users} label="Total Headcount" value={totalPositions} color="green" delay={0.1} />
        <StatCard icon={Gift} label="Total Referrals" value={totalReferrals} color="purple" delay={0.15} />
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-7">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search positions..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
        </select>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="px-4 py-2.5 text-[13px] border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Position Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <EmptyState icon={Briefcase} title="No open positions" description="There are currently no open requirements." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((req, i) => {
            const loc = locationConfig[req.location_type] || locationConfig.onsite;
            const skills = req.skills ? req.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
            const refCount = referralCountMap[req.id] || 0;
            return (
              <motion.div key={req.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -3 }}
              >
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] h-[220px] flex flex-col cursor-pointer"
                  onClick={() => { setSelectedReq(req); setDetailTab('details'); }}>
                  <div className="p-5 flex flex-col flex-1 min-h-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-[14px] font-bold text-slate-900 flex-1 leading-snug line-clamp-1">{req.title}</h3>
                      <span className={`ml-2 px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize shrink-0 ${priorityConfig[req.priority] || priorityConfig.medium}`}>
                        {req.priority}
                      </span>
                    </div>

                    {req.description && <p className="text-[12px] text-slate-500 mb-3 line-clamp-1 leading-relaxed">{req.description}</p>}

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white bg-gradient-to-r ${loc.gradient}`}>
                        <MapPin size={11} /> {loc.label}
                      </span>
                      {req.project && (
                        <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-[10px] font-semibold ring-1 ring-inset ring-primary-200">
                          {req.project?.replace('VCC - ', '')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <Users size={12} /> {req.positions_count}
                      </span>
                      {refCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-50 text-accent-700 rounded-lg text-[10px] font-semibold ring-1 ring-inset ring-accent-200">
                          <Gift size={11} /> {refCount} referral{refCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3 overflow-hidden max-h-[26px]">
                        {skills.slice(0, 4).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md text-[10px] font-medium border border-slate-100">{skill}</span>
                        ))}
                        {skills.length > 4 && <span className="text-[10px] text-slate-400 font-medium py-0.5">+{skills.length - 4}</span>}
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {!isAdmin && (
                          <button onClick={() => { setReferralForm({ ...emptyReferral, requirementId: req.id }); setResumeFile(null); setShowReferralModal(true); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-gradient-to-r from-accent-500 to-accent-600 rounded-lg hover:opacity-90 transition-all shadow-sm">
                            <Gift size={12} /> Refer
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <select value={req.status} onChange={e => handleStatusChange(req.id, e.target.value)}
                              className="text-[10px] border border-slate-200 rounded-lg px-1.5 py-0.5 focus:outline-none">
                              <option value="open">Open</option>
                              <option value="on_hold">On Hold</option>
                              <option value="closed">Closed</option>
                            </select>
                            <button onClick={() => openEdit(req)} className="p-1 text-slate-400 hover:text-primary-600 rounded hover:bg-primary-50 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(req.id)} className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail View Modal with Tabs */}
      <Modal isOpen={!!selectedReq} onClose={() => setSelectedReq(null)} title={selectedReq?.title || ''} maxWidth="max-w-4xl">
        {selectedReq && (() => {
          const req = selectedReq;
          const loc = locationConfig[req.location_type] || locationConfig.onsite;
          const skills = req.skills ? req.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
          const reqReferrals = getReqReferrals(req.id);

          return (
            <div>
              {/* Tabs */}
              <div className="flex gap-1 mb-5 bg-slate-50 p-1 rounded-xl w-fit">
                <button onClick={() => setDetailTab('details')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${detailTab === 'details' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  Details
                </button>
                <button onClick={() => setDetailTab('referrals')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${detailTab === 'referrals' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  Referrals {reqReferrals.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-accent-100 text-accent-700 rounded-md text-[10px] font-bold">{reqReferrals.length}</span>}
                </button>
              </div>

              {detailTab === 'details' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r ${loc.gradient}`}>
                      <MapPin size={12} /> {loc.label}
                    </span>
                    {req.location_detail && <span className="text-[12px] text-slate-500">{req.location_detail}</span>}
                    {req.project && (
                      <span className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-[11px] font-semibold ring-1 ring-inset ring-primary-200">
                        {req.project}
                      </span>
                    )}
                    <span className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize ${priorityConfig[req.priority] || priorityConfig.medium}`}>
                      {req.priority}
                    </span>
                  </div>

                  {req.description && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                      <p className="text-[13px] text-slate-600 leading-relaxed">{req.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Positions</p>
                      <p className="text-[18px] font-bold text-slate-800 mt-1">{req.positions_count}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</p>
                      <p className="text-[14px] font-semibold text-slate-800 mt-1 capitalize">{(req.status || 'open').replace('_', ' ')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Referrals</p>
                      <p className="text-[18px] font-bold text-slate-800 mt-1">{reqReferrals.length}</p>
                    </div>
                  </div>

                  {skills.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Required Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {skills.map(skill => (
                          <span key={skill} className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {req.jd_filename && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Job Description</p>
                      <button
                        type="button"
                        onClick={() => openStoredFile(req.jd_file)}
                        disabled={!req.jd_file}
                        title={req.jd_file ? 'Open job description' : 'File not available'}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:cursor-default"
                      >
                        <FileText size={14} className="text-primary-500" />
                        <span className="text-[12px] font-medium text-slate-700">{req.jd_filename}</span>
                      </button>
                    </div>
                  )}

                  {req.requested_by && (
                    <div className="flex items-center gap-2 text-[13px] text-slate-600">
                      <User size={14} className="text-slate-400" />
                      <span className="font-medium">Requested by:</span> {req.requested_by}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                    {!isAdmin && (
                      <button onClick={() => { setReferralForm({ ...emptyReferral, requirementId: req.id }); setResumeFile(null); setSelectedReq(null); setShowReferralModal(true); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-accent-500 to-accent-600 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-accent-500/25">
                        <Gift size={16} /> Refer a Candidate
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={() => { setSelectedReq(null); openEdit(req); }}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                          <Pencil size={14} /> Edit
                        </button>
                        <button onClick={() => { setSelectedReq(null); handleDelete(req.id); }}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 size={14} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Referrals Tab */
                <div>
                  {reqReferrals.length === 0 ? (
                    <EmptyState icon={Gift} title="No referrals yet" description="No candidates have been referred for this position." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Candidate</th>
                            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Referred By</th>
                            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Resume</th>
                            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqReferrals.map((ref, i) => (
                            <motion.tr key={ref.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                              className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <p className="text-[13px] font-medium text-slate-800">{ref.candidate_name}</p>
                                {ref.notes && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{ref.notes}</p>}
                              </td>
                              <td className="py-3 px-4">
                                <div className="text-[12px] text-slate-600">
                                  {ref.candidate_email && <p>{ref.candidate_email}</p>}
                                  {ref.candidate_phone && <p className="text-slate-400">{ref.candidate_phone}</p>}
                                  {!ref.candidate_email && !ref.candidate_phone && <span className="text-slate-300">-</span>}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-[13px] text-slate-600">{ref.referred_by_name || ref.referred_by || '-'}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {ref.resume_file ? (
                                    <button
                                      type="button"
                                      onClick={() => openStoredFile(ref.resume_file)}
                                      title="Open resume"
                                      className="inline-flex items-center gap-1 text-[11px] text-primary-600 font-medium hover:text-primary-800"
                                    >
                                      <FileText size={12} /> {ref.resume_filename || 'View resume'}
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-slate-300">No resume</span>
                                  )}
                                  <label
                                    title={ref.resume_file ? 'Replace resume' : 'Upload resume'}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-primary-600 cursor-pointer"
                                  >
                                    {refResumeUploadingId === ref.id ? (
                                      <span>Uploading…</span>
                                    ) : (
                                      <><Upload size={11} /> {ref.resume_file ? 'Replace' : 'Upload'}</>
                                    )}
                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                                      onChange={(e) => handleReferralResumeUpload(ref, e)} disabled={refResumeUploadingId === ref.id} />
                                  </label>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {isAdmin ? (
                                  <select value={ref.status || 'submitted'} onChange={async e => {
                                    await api.put(`/referrals/${ref.id}`, { status: e.target.value });
                                    fetchReferrals();
                                  }}
                                    className="text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
                                    <option value="submitted">Submitted</option>
                                    <option value="screening">Screening</option>
                                    <option value="interview">Interview</option>
                                    <option value="selected">Selected</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="joined">Joined</option>
                                  </select>
                                ) : (
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize ${referralStatusConfig[ref.status] || referralStatusConfig.submitted}`}>
                                    {(ref.status || 'submitted').replace('_', ' ')}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-[12px] text-slate-400">
                                {ref.created_at ? new Date(ref.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Create/Edit Requirement Modal (admin only) */}
      {isAdmin && (
        <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditId(null); }} title={editId ? 'Edit Requirement' : 'New Requirement'}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <input type="text" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location Type</label>
                <select value={form.locationType} onChange={e => setForm({ ...form, locationType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
                  <option value="onsite">On-site</option>
                  <option value="offshore">Offshore</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Positions</label>
                <input type="number" min="1" value={form.positionsCount} onChange={e => setForm({ ...form, positionsCount: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location Detail</label>
                <input type="text" value={form.locationDetail} onChange={e => setForm({ ...form, locationDetail: e.target.value })} placeholder="e.g. Chennai"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma-separated)</label>
                <input type="text" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, AWS"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requested By</label>
                <input type="text" value={form.requestedBy} onChange={e => setForm({ ...form, requestedBy: e.target.value })} placeholder="Name or email"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Description (optional)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:border-primary-400 transition-colors">
                {jdFile ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-700"><FileText size={16} /> {jdFile.name}</span>
                    <button onClick={() => setJdFile(null)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
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
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setEditId(null); setJdFile(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25">{editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Referral Modal */}
      <Modal isOpen={showReferralModal} onClose={() => setShowReferralModal(false)} title="Refer a Candidate">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Position *</label>
            <select value={referralForm.requirementId} onChange={e => setReferralForm({ ...referralForm, requirementId: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
              <option value="">Select a position</option>
              {requirements.filter(r => r.status === 'open').map(r => (
                <option key={r.id} value={r.id}>{r.title} — {r.project?.replace('VCC - ', '')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Name *</label>
            <input type="text" value={referralForm.candidateName} onChange={e => setReferralForm({ ...referralForm, candidateName: e.target.value })}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={referralForm.candidateEmail} onChange={e => setReferralForm({ ...referralForm, candidateEmail: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="text" value={referralForm.candidatePhone} onChange={e => setReferralForm({ ...referralForm, candidatePhone: e.target.value })}
                className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={referralForm.notes} onChange={e => setReferralForm({ ...referralForm, notes: e.target.value })} rows={2} placeholder="Why you recommend this candidate..."
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Resume</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:border-primary-400 transition-colors">
              {resumeFile ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-700"><FileText size={16} /> {resumeFile.name}</span>
                  <button onClick={() => setResumeFile(null)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Upload size={16} /> Upload Resume (.pdf, .docx)
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={e => setResumeFile(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowReferralModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleReferralSubmit} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-accent-500 to-accent-600 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-accent-500/25">
              <span className="flex items-center gap-2"><Send size={14} /> Submit Referral</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
