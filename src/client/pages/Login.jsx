import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Users, ScrollText, ShieldCheck, Briefcase, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SUBROLES = [
  {
    key: 'manager',
    label: 'Client Manager',
    desc: 'Approve timesheets · sign SOWs · manage team',
    icon: Briefcase,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    key: 'finance',
    label: 'Client Finance',
    desc: 'Review SOWs · approve invoices · record payments',
    icon: Receipt,
    gradient: 'from-amber-500 to-orange-600',
  },
];

const features = [
  { icon: Building2, title: 'Vendor directory', desc: 'A single source of truth for your supplier network' },
  { icon: Users, title: 'Project roster', desc: 'Track every resource and contracted billing rate' },
  { icon: ScrollText, title: 'SOW workflow', desc: 'Review, approve, and sign engagements in one place' },
  { icon: ShieldCheck, title: 'Audit-ready', desc: 'Every approval and payment trail captured automatically' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Already signed in? Skip the login screen.
  useEffect(() => {
    if (user) navigate('/client/dashboard', { replace: true });
  }, [user, navigate]);

  const [selectedSubrole, setSelectedSubrole] = useState('manager');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!employeeId.trim()) { setError('Please enter your Client ID'); return; }
    setLoading(true);
    try {
      const res = await login(employeeId.trim(), selectedSubrole);
      if (res.ok) navigate('/client/dashboard');
      else setError(res.error || 'No client account found with this ID.');
    } finally {
      setLoading(false);
    }
  };

  const pickSubrole = (key) => {
    setSelectedSubrole(key);
    setError('');
    setEmployeeId('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left hero */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[600px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-900 via-cyan-900 to-slate-900" />
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <motion.div
          animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-32 right-10 w-[320px] h-[320px] rounded-full bg-cyan-400/20 blur-[100px]"
        />
        <motion.div
          animate={{ y: [20, -20, 20], x: [10, -10, 10] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-20 left-10 w-[260px] h-[260px] rounded-full bg-sky-400/15 blur-[80px]"
        />

        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5">
              <Building2 size={22} strokeWidth={2.2} className="text-sky-700" />
            </div>
            <div>
              <span className="text-white/95 font-semibold text-[15px] tracking-tight">VCC Vendor Tool</span>
              <p className="text-white/40 text-[10px] uppercase tracking-[0.18em] mt-0.5">Vendor Management Suite</p>
            </div>
          </motion.div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[42px] font-bold text-white leading-[1.08] tracking-[-0.03em] mb-4"
            >
              Manage every
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-cyan-300 bg-clip-text text-transparent">
                vendor engagement
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-[15px] text-white/55 leading-relaxed max-w-[400px] mb-10"
            >
              Vendors, project roster, SOWs, invoices and timesheet approvals —
              all in one client portal built for Visual Comfort Company.
            </motion.p>

            <div className="space-y-2.5">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.05] border border-white/[0.07] backdrop-blur-sm"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/[0.08] flex items-center justify-center">
                    <f.icon size={18} className="text-cyan-200" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white/90">{f.title}</p>
                    <p className="text-[11px] text-white/40">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-white/30 text-[11px]"
          >
            Vendor Management Tool · v1.0 · Visual Comfort Company
          </motion.p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px]"
        >
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-cyan-600 shadow-md flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="font-bold text-[16px] text-slate-900">VCC Vendor Tool</span>
          </div>

          <h2 className="text-[28px] font-bold text-slate-900 tracking-[-0.03em]">Client sign-in</h2>
          <p className="text-[14px] text-slate-400 mt-1.5 mb-6">Choose your role to continue</p>

          <div className="grid grid-cols-2 gap-3 mb-7">
            {SUBROLES.map((sr, i) => {
              const active = selectedSubrole === sr.key;
              return (
                <motion.button
                  key={sr.key}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => pickSubrole(sr.key)}
                  className={`relative flex flex-col items-center text-center py-5 px-3 rounded-2xl border-2 transition-all duration-250 ${
                    active
                      ? 'border-sky-500 bg-sky-50/60 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 transition-all duration-250 ${
                    active ? `bg-gradient-to-br ${sr.gradient} shadow-lg` : 'bg-slate-100'
                  }`}>
                    <sr.icon size={20} strokeWidth={1.7} className={active ? 'text-white' : 'text-slate-400'} />
                  </div>
                  <span className={`text-[13px] font-semibold ${active ? 'text-sky-700' : 'text-slate-700'}`}>
                    {sr.label}
                  </span>
                  <span className={`text-[10px] mt-1 leading-tight px-1 ${active ? 'text-sky-600/80' : 'text-slate-400'}`}>
                    {sr.desc}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="vendor-tool-subrole-indicator"
                      className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-sky-500"
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-[12px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">
              Client ID
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => { setEmployeeId(e.target.value); setError(''); }}
              placeholder="e.g. CLI001"
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-white text-[14px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all duration-250"
            />

            <div className="mb-6" />

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white text-[14px] font-semibold flex items-center justify-center gap-2.5 hover:from-sky-700 hover:to-cyan-700 disabled:opacity-60 transition-all duration-250 shadow-lg shadow-sky-600/25"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Enter Vendor Tool
                  <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-400 mt-6">
            VCC Vendor Tool · powered by D4 Insight
          </p>
        </motion.div>
      </div>
    </div>
  );
}
