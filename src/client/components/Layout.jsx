import { Outlet, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/client/login" replace />;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="max-w-[1400px] mx-auto px-6 py-6 lg:px-8 lg:py-7"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
