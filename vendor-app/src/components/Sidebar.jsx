import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight,
  ScrollText, Users, Building2, Receipt, FileCheck, Grid3x3,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navSections = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'Approvals',
    items: [
      { to: '/sows', icon: ScrollText, label: 'SOWs & Quotes' },
      { to: '/timesheets', icon: FileCheck, label: 'Timesheets' },
      { to: '/invoices', icon: Receipt, label: 'Invoices' },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { to: '/roster', icon: Users, label: 'Project Roster' },
      { to: '/nine-box', icon: Grid3x3, label: '9-Box Grid' },
      { to: '/vendors', icon: Building2, label: 'Vendors' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '';
  const portalLabel = user?.client_subrole === 'finance' ? 'Finance Portal' : 'Manager Portal';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 264 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-screen bg-white border-r border-slate-200/80 flex flex-col sticky top-0 z-20 select-none overflow-hidden"
    >
      {/* Header */}
      <div className="h-[60px] flex items-center justify-between px-4 border-b border-slate-100">
        {!collapsed ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-9 h-9 rounded-xl flex-shrink-0 bg-gradient-to-br from-sky-600 to-cyan-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-[15px] font-bold leading-none">V</span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 truncate leading-none tracking-[-0.01em]">VCC Vendor Tool</p>
              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{portalLabel}</p>
            </div>
          </motion.div>
        ) : (
          <div className="w-9 h-9 rounded-xl mx-auto bg-gradient-to-br from-sky-600 to-cyan-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-[15px] font-bold leading-none">V</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150 flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-3 overflow-y-auto">
        {collapsed ? (
          <div className="space-y-1 pt-1">
            {navSections.flatMap(s => s.items).map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative group flex items-center justify-center w-full h-10 rounded-xl transition-all duration-150"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 w-[3px] h-5 rounded-r-full bg-primary-600"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <item.icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                </NavLink>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {navSections.map((section, si) => (
              <div key={section.title}>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: si * 0.05 }}
                  className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-3 mb-1.5"
                >
                  {section.title}
                </motion.p>
                <div className="space-y-0.5">
                  {section.items.map((item, i) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className="relative group"
                      >
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: si * 0.05 + i * 0.03, duration: 0.25 }}
                          className={`flex items-center gap-3 h-[38px] px-3 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="sidebar-indicator"
                              className="absolute left-0 w-[3px] h-5 rounded-r-full bg-primary-600"
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            />
                          )}
                          <item.icon size={18} strokeWidth={isActive ? 2 : 1.7} className={`flex-shrink-0 transition-colors ${isActive ? 'text-primary-600' : ''}`} />
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"
                            />
                          )}
                        </motion.div>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-3">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl bg-slate-50/80 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-[11px] font-bold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-800 truncate leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize mt-1 leading-none">
                  {user?.client_subrole || 'Client'} &middot; {user?.id}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full h-9 px-3 rounded-xl text-[12px] font-medium text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-all duration-200"
            >
              <LogOut size={16} strokeWidth={1.8} />
              <span>Sign out</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-[10px] font-bold">{initials}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-all duration-150"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
