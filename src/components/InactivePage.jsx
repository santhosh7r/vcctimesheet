import { motion } from 'framer-motion';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InactivePage({ title = 'This page is inactive', subtitle, backTo = '/', backLabel = 'Go back' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="min-h-[60vh] flex items-center justify-center px-6 py-10"
    >
      <div className="max-w-md w-full bg-white border border-slate-200/70 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-8 py-10 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <Construction size={24} strokeWidth={1.8} className="text-slate-400" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 mb-1.5">Module inactive</p>
        <h1 className="text-[22px] font-bold text-slate-900 tracking-[-0.02em] leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">{subtitle}</p>}
        <p className="text-[12px] text-slate-400 mt-4">This area is temporarily disabled. Reach out to your administrator if you need access.</p>
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 mt-6 h-9 px-4 rounded-xl bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2.4} />
          {backLabel}
        </Link>
      </div>
    </motion.div>
  );
}
