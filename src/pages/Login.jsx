import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, BarChart3, Shield, Mail, Lock, Eye, EyeOff, FileSpreadsheet, Users, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: Zap, title: 'Fast & Simple', desc: 'Submit timesheets in minutes' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track hours across projects' },
  { icon: Shield, title: 'Secure & Reliable', desc: 'Enterprise-grade security' },
];

// The client/vendor tool is a separate app/deployment.
// Priority: explicit VITE_VENDOR_TOOL_URL → local vendor-app dev server (port 5174)
// in dev → the production Vercel deployment otherwise.
const VENDOR_TOOL_URL =
  import.meta.env.VITE_VENDOR_TOOL_URL ||
  (import.meta.env.DEV ? 'http://localhost:5174' : 'https://vccdev.vercel.app/vendor-tool');

const portals = [
  { key: 'admin',   label: 'Admin Portal',   desc: 'Full platform access',    icon: FileSpreadsheet, gradient: 'from-emerald-500 to-teal-600' },
  { key: 'manager', label: 'Manager Portal', desc: 'Approvals & team view',   icon: Users,           gradient: 'from-violet-500 to-purple-600' },
  { key: 'client',  label: 'Client Portal',  desc: 'Vendor tool & approvals', icon: Building2,       gradient: 'from-sky-500 to-cyan-600', internal: '/client/login' },
];

const ROLE_DEST = {
  admin: '/admin/dashboard',
  manager: '/manager/dashboard',
  finance: '/finance/invoices',
  employee: '/employee/timesheet',
  consultant: '/employee/timesheet',
};

export default function Login() {
  const { user, emailLogin, loginError } = useAuth();
  const navigate = useNavigate();
  const [selectedPortal, setSelectedPortal] = useState(null); // null | 'admin' | 'finance'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (user) navigate(ROLE_DEST[user.role] || '/admin/dashboard');
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await emailLogin(email.trim(), password, selectedPortal);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const goBackToPortals = () => {
    setSelectedPortal(null);
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const portalMeta = portals.find(p => p.key === selectedPortal);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel — hero */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900" />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <motion.div
          animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-32 right-10 w-[300px] h-[300px] rounded-full bg-primary-500/20 blur-[100px]"
        />
        <motion.div
          animate={{ y: [20, -20, 20], x: [10, -10, 10] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-20 left-10 w-[250px] h-[250px] rounded-full bg-accent-400/15 blur-[80px]"
        />

        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1">
              <img src="/logo-01.png" alt="D4 Insight" className="w-full h-full object-contain" />
            </div>
            <span className="text-white/90 font-semibold text-[16px]">D4 Insight</span>
          </motion.div>

          <div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[44px] font-bold text-white leading-[1.1] tracking-[-0.03em] mb-4"
            >
              Time tracking,
              <br />
              <span className="bg-gradient-to-r from-primary-300 via-accent-300 to-primary-300 bg-clip-text text-transparent">
                simplified.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-[15px] text-white/50 leading-relaxed max-w-[380px] mb-12"
            >
              Submit timesheets, track hours, manage leaves, and generate
              consolidated reports across all your projects.
            </motion.p>

            <div className="space-y-3">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-4 py-3 px-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/[0.08] flex items-center justify-center">
                    <f.icon size={18} className="text-white/70" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-white/90 font-semibold text-[13px]">{f.title}</p>
                    <p className="text-white/40 text-[11px]">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-white/50 text-[11px]">
            <div><span className="text-white font-bold text-[18px] tabular-nums">15+</span><br />Projects</div>
            <div><span className="text-white font-bold text-[18px] tabular-nums">50+</span><br />Employees</div>
            <div><span className="text-white font-bold text-[18px] tabular-nums">Bi-weekly</span><br />Cycles</div>
          </div>
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px]"
        >
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center p-1">
              <img src="/logo-01.png" alt="D4 Insight" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-[16px] text-slate-900">D4 Insight</span>
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1 — Choose portal */}
            {!selectedPortal && (
              <motion.div
                key="portal-step"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-[28px] font-bold text-slate-900 tracking-[-0.03em]">Welcome back</h2>
                <p className="text-[14px] text-slate-400 mt-1.5 mb-8">Choose your portal to continue</p>

                <div className="grid grid-cols-1 gap-3">
                  {portals.map((p, i) => (
                    <motion.button
                      key={p.key}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.08 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => p.internal ? navigate(p.internal) : p.external ? (window.location.href = p.external) : setSelectedPortal(p.key)}
                      className="group relative flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-primary-300 hover:shadow-md transition-all duration-250 text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${p.gradient} shadow-lg shrink-0`}>
                        <p.icon size={22} strokeWidth={1.8} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-slate-800">{p.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                      </div>
                      <ArrowLeft size={16} className="text-slate-300 rotate-180 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2 — Email + password for chosen portal */}
            {selectedPortal && (
              <motion.div
                key="creds-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={goBackToPortals}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 mb-6 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to portal selection
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${portalMeta.gradient} shadow-lg`}>
                    <portalMeta.icon size={20} strokeWidth={1.8} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold text-slate-900 tracking-[-0.02em]">{portalMeta.label}</h2>
                    <p className="text-[12px] text-slate-400">Enter your email and password</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@d4insight.com"
                        autoComplete="email"
                        autoFocus
                        required
                        className="w-full h-12 pl-10 pr-3 rounded-xl border-2 border-slate-200 bg-white text-[14px] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className="w-full h-12 pl-10 pr-10 rounded-xl border-2 border-slate-200 bg-white text-[14px] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <p className="text-[12px] text-red-500 px-1">{loginError}</p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={isLoggingIn || !email || !password}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-500/20 disabled:opacity-60 mt-2"
                  >
                    {isLoggingIn ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      `Sign in to ${portalMeta.label}`
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-[11px] text-slate-400 mt-10"
          >
            D4 Insight v2.0
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
