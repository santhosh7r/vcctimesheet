import { motion } from 'framer-motion';

const gradients = {
  blue: 'from-blue-500 to-indigo-600',
  green: 'from-emerald-500 to-teal-600',
  purple: 'from-violet-500 to-purple-600',
  orange: 'from-orange-400 to-amber-500',
  rose: 'from-rose-500 to-pink-600',
  cyan: 'from-cyan-500 to-blue-500',
  slate: 'from-slate-500 to-slate-600',
};

export default function StatCard({ icon: Icon, label, value, change, color = 'blue', delay = 0 }) {
  const grad = gradients[color] || gradients.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] cursor-default group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300`}
          style={{ boxShadow: `0 4px 14px -2px rgba(0,0,0,0.15)` }}
        >
          <Icon size={20} strokeWidth={1.8} className="text-white" />
        </div>
        {change && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            change.startsWith('+') ? 'bg-accent-50 text-accent-700' : 'bg-danger-50 text-danger-600'
          }`}>
            {change}
          </span>
        )}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.15 }}
        className="text-[28px] font-bold text-slate-900 tracking-tight tabular-nums leading-none"
      >
        {value}
      </motion.p>
      <p className="text-[12px] text-slate-400 mt-1.5 font-medium">{label}</p>
    </motion.div>
  );
}
