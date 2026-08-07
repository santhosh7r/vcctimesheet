import { motion } from 'framer-motion';

export default function PageHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/20"
          >
            <Icon size={20} strokeWidth={1.8} className="text-white" />
          </motion.div>
        )}
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-[22px] font-bold text-slate-900 tracking-[-0.025em] leading-tight"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="text-[13px] text-slate-500 mt-0.5"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>
      {actions && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-2.5"
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}
