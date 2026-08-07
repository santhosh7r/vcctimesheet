import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

// Cell styling/labels keyed by `${potential}-${performance}` (mirrors the admin grid).
const gridConfig = {
  'high-low': { label: 'Potential Talent', bg: 'bg-amber-200', text: 'text-amber-900' },
  'high-medium': { label: 'Growth Potential', bg: 'bg-lime-300', text: 'text-lime-900' },
  'high-high': { label: 'Top Talent', bg: 'bg-cyan-500', text: 'text-white' },
  'medium-low': { label: 'Inconsistent Player', bg: 'bg-rose-400', text: 'text-white' },
  'medium-medium': { label: 'Core Player', bg: 'bg-amber-300', text: 'text-amber-900' },
  'medium-high': { label: 'High Performer', bg: 'bg-cyan-500', text: 'text-white' },
  'low-low': { label: 'Risk / Bad Hire', bg: 'bg-rose-500', text: 'text-white' },
  'low-medium': { label: 'Average Player', bg: 'bg-rose-400', text: 'text-white' },
  'low-high': { label: 'Solid Performer', bg: 'bg-amber-300', text: 'text-amber-900' },
};

const potentialLevels = ['high', 'medium', 'low'];
const performanceLevels = ['low', 'medium', 'high'];

export default function NineBoxGrid() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(`Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ project: '', userId: '', potential: 'medium', performance: 'medium', notes: '', hourlyRate: '' });

  const period = `${quarter} ${year}`;

  const fetchPlacements = () => {
    api.get(`/ninebox?period=${encodeURIComponent(period)}`)
      .then(data => setPlacements(data.placements || []))
      .catch(() => setPlacements([]));
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/ninebox?period=${encodeURIComponent(period)}`)
      .then(data => setPlacements(data.placements || []))
      .catch(() => setPlacements([]))
      .finally(() => setLoading(false));
  }, [period]);

  // Resource list for the Place modal (mirrors admin — drawn from the roster).
  useEffect(() => {
    api.get('/roster')
      .then(d => setEmployees((d.users || []).filter(u => u.is_active !== false)))
      .catch(() => setEmployees([]));
  }, []);

  const PROJECTS = useMemo(
    () => [...new Set(employees.map(e => e.project).filter(Boolean))].sort(),
    [employees]
  );

  const cellPlacements = (potential, performance) =>
    placements.filter(p => p.potential === potential && p.performance === performance);

  const placedUserIds = new Set(placements.map(p => p.user_id));
  const projectEmployees = form.project ? employees.filter(e => e.project === form.project) : [];
  const projectEmpIds = new Set(projectEmployees.map(e => e.id));
  const projectUnplaced = projectEmployees.filter(e => !placedUserIds.has(e.id));
  const projectPlaced = placements.filter(p => projectEmpIds.has(p.user_id));

  const handlePlace = async () => {
    if (!form.userId) return;
    setSaving(true);
    try {
      await api.post('/ninebox', { ...form, hourlyRate: parseFloat(form.hourlyRate) || 0, period });
      setShowModal(false);
      setForm({ project: '', userId: '', potential: 'medium', performance: 'medium', notes: '', hourlyRate: '' });
      fetchPlacements();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    await api.del(`/ninebox/${id}`);
    fetchPlacements();
  };

  const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500";
  const canPlace = !!user;

  return (
    <div>
      <PageHeader
        icon={Grid3x3}
        title="9-Box Performance Grid"
        subtitle="Potential vs performance for resources on your engagements"
        actions={canPlace ? (
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> Place Employee
          </button>
        ) : null}
      />

      {/* Period selector */}
      <div className="flex gap-4 mb-6">
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <button key={q} onClick={() => setQuarter(q)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${quarter === q ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {q}
            </button>
          ))}
        </div>
        <div className="text-sm text-slate-500 flex items-center">{placements.length} resources placed</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
          <div className="flex">
            {/* Y-axis label */}
            <div className="flex flex-col items-center justify-center mr-2 w-8">
              <span className="text-xs font-semibold text-slate-500 tracking-wider [writing-mode:vertical-lr] rotate-180">
                Potential
              </span>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-3 gap-2">
                {potentialLevels.map(potential =>
                  performanceLevels.map(performance => {
                    const key = `${potential}-${performance}`;
                    const config = gridConfig[key];
                    const cells = cellPlacements(potential, performance);
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className={`${config.bg} ${config.text} rounded-2xl p-4 min-h-[140px] relative`}
                      >
                        <div className="text-xs font-bold mb-3 text-center">{config.label}</div>
                        <div className="space-y-1.5">
                          {cells.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-white/80 rounded-xl px-2.5 py-1.5 text-xs group">
                              <span className="text-slate-800 font-medium truncate">{p.user_name || p.user_id}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-600 font-semibold tabular-nums">${p.hourly_rate || 0}</span>
                                {canPlace && (
                                  <button onClick={() => handleRemove(p.id)}
                                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition-opacity">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              <div className="text-center mt-3">
                <span className="text-xs font-semibold text-slate-500 tracking-wider">Performance</span>
              </div>
              <div className="grid grid-cols-3 mt-1">
                <div className="text-center text-xs text-slate-400">Low</div>
                <div className="text-center text-xs text-slate-400">Medium</div>
                <div className="text-center text-xs text-slate-400">High</div>
              </div>
            </div>

            {/* Y-axis markers */}
            <div className="flex flex-col justify-around ml-2 w-12">
              <div className="text-xs text-slate-400 text-center">High</div>
              <div className="text-xs text-slate-400 text-center">Med</div>
              <div className="text-xs text-slate-400 text-center">Low</div>
            </div>
          </div>

          {placements.length === 0 && (
            <p className="text-center text-[13px] text-slate-400 mt-6">No placements recorded for {period}.</p>
          )}
        </motion.div>
      )}

      {/* Place Employee Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Place Employee" maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
            <select value={form.project} onChange={e => setForm({ ...form, project: e.target.value, userId: '' })} className={inputClass}>
              <option value="">Select project...</option>
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <select value={form.userId} disabled={!form.project} onChange={e => {
              const uid = e.target.value;
              const existing = placements.find(p => p.user_id === uid);
              setForm({ ...form, userId: uid, hourlyRate: existing?.hourly_rate || form.hourlyRate });
            }} className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}>
              <option value="">{form.project ? 'Select employee...' : 'Select a project first'}</option>
              {projectUnplaced.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>)}
              {projectPlaced.map(p => <option key={p.user_id} value={p.user_id}>{p.user_name || p.user_id} (update)</option>)}
            </select>
            {form.project && projectUnplaced.length === 0 && projectPlaced.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-1">No employees found in this project.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Potential</label>
              <select value={form.potential} onChange={e => setForm({ ...form, potential: e.target.value })} className={inputClass}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Performance</label>
              <select value={form.performance} onChange={e => setForm({ ...form, performance: e.target.value })} className={inputClass}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate ($)</label>
            <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} placeholder="e.g. 25.00" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handlePlace} disabled={saving || !form.userId} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25 disabled:opacity-50">{saving ? 'Placing…' : 'Place'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
