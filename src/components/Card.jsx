import { motion } from 'framer-motion';

export default function Card({ children, className = '', animate = true, delay = 0, hover = false, ...props }) {
  const Wrapper = animate ? motion.div : 'div';
  const animProps = animate
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] },
      }
    : {};

  const hoverProps = hover && animate
    ? {
        whileHover: { y: -2, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04)' },
        transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] },
      }
    : {};

  return (
    <Wrapper
      className={`bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] ${className}`}
      {...animProps}
      {...hoverProps}
      {...props}
    >
      {children}
    </Wrapper>
  );
}
