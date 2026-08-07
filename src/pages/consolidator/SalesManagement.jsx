import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Plus, TrendingUp, Target, Award } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';

const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const stageConfig = {
  prospect: { label: 'Prospect', color: 'bg-slate-100 text-slate-700', headerBg: 'bg-slate-50' },
  qualified: { label: 'Qualified', color: 'bg-primary-100 text-primary-700', headerBg: 'bg-primary-50' },
  proposal: { label: 'Proposal', color: 'bg-warning-100 text-warning-700', headerBg: 'bg-warning-50' },
  negotiation: { label: 'Negotiation', color: 'bg-purple-100 text-purple-700', headerBg: 'bg-purple-50' },
  closed_won: { label: 'Won', color: 'bg-accent-100 text-accent-700', headerBg: 'bg-accent-50' },
  closed_lost: { label: 'Lost', color: 'bg-danger-100 text-danger-700', headerBg: 'bg-danger-50' },
};

const emptyForm = {
  title: '', clientName: '', dealValue: '', currency: 'USD',
  stage: 'prospect', probability: 20, expectedCloseDate: '', notes: '',
};

export default function SalesManagement() {
  const { user } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchDeals = () => {
    api.get('/sales').then(data => setDeals(data.deals || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDeals(); }, []);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const body = { ...form, ownerId: user.id };
    if (editId) {
      await api.put(`/sales/${editId}`, body);
    } else {
      await api.post('/sales', body);
    }
    setShowModal(false);
    setEditId(null);
    setForm({ ...emptyForm });
    fetchDeals();
  };

  const handleStageChange = async (dealId, stage) => {
    await api.put(`/sales/${dealId}`, { stage });
    fetchDeals();
  };

  const handleDelete = async (id) => {
    await api.del(`/sales/${id}`);
    fetchDeals();
  };

  const openEdit = (deal) => {
    setEditId(deal.id);
    setForm({
      title: deal.title, clientName: deal.client_name || '', dealValue: deal.deal_value || '',
      currency: deal.currency || 'USD', stage: deal.stage, probability: deal.probability || 0,
      expectedCloseDate: deal.expected_close_date || '', notes: deal.notes || '',
    });
    setShowModal(true);
  };

  const pipelineValue = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + (d.deal_value || 0), 0);
  const wonValue = deals.filter(d => d.stage === 'closed_won').reduce((s, d) => s + (d.deal_value || 0), 0);
  const wonCount = deals.filter(d => d.stage === 'closed_won').length;
  const closedCount = deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost').length;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  const formatCurrency = (val) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  const inputClass = "w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500";

  return (
    <div>
      <PageHeader
        icon={DollarSign}
        title="Sales Management"
        subtitle="Track deals and manage your sales pipeline"
        actions={
          <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary-600/25">
            <Plus size={16} /> New Deal
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Pipeline Value" value={formatCurrency(pipelineValue)} color="blue" delay={0} />
        <StatCard icon={TrendingUp} label="Won Revenue" value={formatCurrency(wonValue)} color="green" delay={0.05} />
        <StatCard icon={Target} label="Win Rate" value={`${winRate}%`} color="orange" delay={0.1} />
        <StatCard icon={Award} label="Total Deals" value={deals.length} color="slate" delay={0.15} />
      </div>

      {/* Kanban Pipeline */}
      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 overflow-x-auto">
          {stages.map(stage => {
            const config = stageConfig[stage];
            const stageDeals = deals.filter(d => d.stage === stage);
            const stageTotal = stageDeals.reduce((s, d) => s + (d.deal_value || 0), 0);

            return (
              <div key={stage} className="min-w-[200px]">
                <div className={`${config.headerBg} rounded-t-2xl px-3 py-2 border border-b-0 border-slate-200/60`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${config.color.split(' ')[1]}`}>{config.label}</span>
                    <span className="text-xs text-slate-500">{stageDeals.length}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(stageTotal)}</div>
                </div>
                <div className="border border-slate-200/60 rounded-b-2xl p-2 space-y-2 min-h-[200px] bg-white">
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">No deals</p>
                  ) : (
                    stageDeals.map((deal, i) => (
                      <motion.div key={deal.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -3 }}
                        className="rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 cursor-pointer hover:bg-slate-50/80 transition-colors group" onClick={() => openEdit(deal)}>
                        <div className="text-sm font-medium text-slate-900 mb-1">{deal.title}</div>
                        {deal.client_name && <div className="text-xs text-slate-500 mb-2">{deal.client_name}</div>}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(deal.deal_value)}</span>
                          <span className="text-xs text-slate-400">{deal.probability}%</span>
                        </div>
                        {deal.expected_close_date && (
                          <div className="text-xs text-slate-400 mt-1">
                            Close: {new Date(deal.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditId(null); }} title={editId ? 'Edit Deal' : 'New Deal'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deal Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
              <input type="text" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deal Value ($)</label>
              <input type="number" value={form.dealValue} onChange={e => setForm({ ...form, dealValue: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Probability (%)</label>
              <input type="number" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: parseInt(e.target.value) || 0 })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className={inputClass}>
                {stages.map(s => <option key={s} value={s}>{stageConfig[s].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Close Date</label>
            <input type="date" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            {editId && (
              <button onClick={() => { handleDelete(editId); setShowModal(false); setEditId(null); }}
                className="px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 rounded-xl transition-colors mr-auto">Delete Deal</button>
            )}
            <button onClick={() => { setShowModal(false); setEditId(null); }} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-primary-600/25">{editId ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
