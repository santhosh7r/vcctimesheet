import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[6px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className={`relative ${maxWidth} w-full max-h-[85vh] bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col border border-slate-200/50`}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-[16px] font-bold text-slate-900 tracking-[-0.01em]">{title}</h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-200"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
