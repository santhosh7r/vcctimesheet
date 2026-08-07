import { motion } from 'framer-motion';
import { Check, Clock, Pause, Snowflake, AlertCircle, X } from 'lucide-react';

const config = {
  submitted: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    ring: 'ring-accent-200',
    dot: 'bg-accent-500',
    icon: Check,
    label: 'Submitted',
  },
  saved: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    ring: 'ring-warning-200',
    dot: 'bg-warning-500',
    icon: Pause,
    label: 'Saved',
  },
  pending: {
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    ring: 'ring-slate-200',
    dot: 'bg-slate-400',
    icon: Clock,
    label: 'Pending',
  },
  frozen: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
    icon: Snowflake,
    label: 'Frozen',
  },
  approved: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    ring: 'ring-accent-200',
    dot: 'bg-accent-500',
    icon: Check,
    label: 'Approved',
  },
  partial: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
    icon: AlertCircle,
    label: 'Partial',
  },
  rejected: {
    bg: 'bg-danger-50',
    text: 'text-danger-600',
    ring: 'ring-danger-200',
    dot: 'bg-danger-500',
    icon: X,
    label: 'Rejected',
  },
  active: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    ring: 'ring-accent-200',
    dot: 'bg-accent-500',
    icon: Check,
    label: 'Active',
  },
  open: {
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    ring: 'ring-primary-200',
    dot: 'bg-primary-500',
    icon: AlertCircle,
    label: 'Open',
  },
};

export default function StatusBadge({ status, size = 'default' }) {
  const c = config[status] || config.pending;
  const IconComp = c.icon;
  const isSmall = size === 'sm';

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium ${c.bg} ${c.text} ${c.ring} ${
        isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      <span className={`rounded-full ${c.dot} ${isSmall ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
      {c.label}
    </motion.span>
  );
}
