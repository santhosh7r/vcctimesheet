import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'No data found', description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center mb-5 shadow-sm"
      >
        <Icon size={28} strokeWidth={1.5} className="text-slate-400" />
      </motion.div>
      <h3 className="text-[16px] font-semibold text-slate-700 mb-1.5">{title}</h3>
      {description && <p className="text-[13px] text-slate-400 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
