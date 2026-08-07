import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Clock, Users, FileSpreadsheet, LogOut, Lock,
  ChevronLeft, ChevronRight, History, FileText, CalendarOff,
  CheckSquare, ListChecks, BarChart3, NotebookPen, Briefcase,
  TrendingUp, Grid3x3, DollarSign, Menu, Search, Bell, Settings,
  FileSignature, Bot, Receipt, Building2, UserCog, ScrollText, FileCheck, ClipboardList,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navSections = {
  employee: [
    {
      title: 'Workspace',
      items: [
        { to: '/employee/timesheet', icon: Clock, label: 'My Timesheet' },
        { to: '/employee/history', icon: History, label: 'History' },
        { to: '/employee/tasks', icon: CheckSquare, label: 'My Tasks' },
      ],
    },
    {
      title: 'Resources',
      items: [
        { to: '/employee/leaves', icon: CalendarOff, label: 'Leaves' },
        { to: '/employee/hiring-board', icon: Briefcase, label: 'Hiring Board' },
      ],
    },
  ],
  manager: [
    {
      title: 'Overview',
      items: [
        { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/manager/kpi', icon: BarChart3, label: 'KPI Dashboard' },
      ],
    },
    {
      title: 'Team',
      items: [
        { to: '/manager/employees', icon: Users, label: 'Employees' },
        { to: '/manager/tasks', icon: ListChecks, label: 'Task Manager' },
        { to: '/manager/leaves', icon: CalendarOff, label: 'Leave Approvals' },
      ],
    },
    {
      title: 'Timesheets',
      items: [
        { to: '/manager/submissions', icon: FileSpreadsheet, label: 'Submissions' },
        { to: '/manager/freeze', icon: Lock, label: 'Freeze Period' },
      ],
    },
    {
      title: 'Performance',
      items: [
        { to: '/admin/sow-workflow', icon: ScrollText, label: 'SOW Workflow' },
        { to: '/admin/sop', icon: FileSignature, label: 'SOW Manager' },
        { to: '/admin/ninebox', icon: Grid3x3, label: '9-Box Grid' },
        { to: '/manager/hiring-board', icon: Briefcase, label: 'Hiring Board' },
      ],
    },
  ],
  finance: [
    {
      title: 'Overview',
      items: [
        { to: '/finance/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/finance/reports', icon: FileSpreadsheet, label: 'Reports' },
      ],
    },
    {
      title: 'Billing',
      items: [
        { to: '/finance/invoices', icon: Receipt, label: 'Invoices' },
        { to: '/finance/billing', icon: DollarSign, label: 'Client Billing' },
        { to: '/finance/clients', icon: Building2, label: 'Clients' },
      ],
    },
    {
      title: 'Payroll',
      items: [
        { to: '/finance/salaries', icon: Users, label: 'Employee Salaries' },
        { to: '/finance/bench', icon: TrendingUp, label: 'Bench Analysis' },
      ],
    },
    {
      title: 'Performance',
      items: [
        { to: '/admin/sow-workflow', icon: ScrollText, label: 'SOW Workflow' },
        { to: '/admin/sop', icon: FileSignature, label: 'SOW Manager' },
      ],
    },
  ],
  admin: [
    {
      title: 'Overview',
      items: [
        { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/admin/analytics', icon: TrendingUp, label: 'Analytics' },
        { to: '/admin/reports', icon: FileSpreadsheet, label: 'Reports' },
      ],
    },
    {
      title: 'People',
      items: [
        { to: '/admin/users', icon: UserCog, label: 'User Management' },
        { to: '/admin/leaves', icon: CalendarOff, label: 'Leaves' },
        { to: '/admin/hiring-board', icon: Briefcase, label: 'Hiring Board' },
      ],
    },
    {
      title: 'Timesheets',
      items: [
        { to: '/admin/submissions', icon: FileSpreadsheet, label: 'Submissions' },
        { to: '/admin/client-timesheets', icon: FileCheck, label: 'Client Timesheets' },
        { to: '/admin/freeze', icon: Lock, label: 'Freeze Period' },
      ],
    },
    {
      title: 'Performance',
      items: [
        { to: '/admin/sow-workflow', icon: ScrollText, label: 'SOW Workflow' },
        { to: '/admin/sop', icon: FileSignature, label: 'SOW Manager' },
        { to: '/admin/ninebox', icon: Grid3x3, label: '9-Box Grid' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/finance/dashboard', icon: DollarSign, label: 'Finance Dashboard' },
        { to: '/finance/reports', icon: FileSpreadsheet, label: 'Finance Reports' },
        { to: '/finance/invoices', icon: Receipt, label: 'Invoices' },
        { to: '/finance/billing', icon: Building2, label: 'Client Billing' },
        { to: '/finance/clients', icon: Users, label: 'Clients' },
        { to: '/finance/bench', icon: TrendingUp, label: 'Bench Analysis' },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
      ],
    },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const sections = navSections[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '';
  const portalLabel = user?.role === 'admin' ? 'Admin Portal' : `${user?.role} Portal`;

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
            <img src="/logo-01.png" alt="D4 Insight" className="w-9 h-9 rounded-xl flex-shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 truncate leading-none tracking-[-0.01em]">D4 Insight</p>
              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{portalLabel}</p>
            </div>
          </motion.div>
        ) : (
          <img src="/logo-01.png" alt="D4 Insight" className="w-9 h-9 rounded-xl mx-auto object-contain" />
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
            {sections.flatMap(s => s.items).map((item) => {
              const isActive = location.pathname === item.to;
              if (item.inactive) {
                return (
                  <div
                    key={item.to}
                    aria-disabled="true"
                    title={`${item.label} (inactive)`}
                    className="relative group flex items-center justify-center w-full h-10 rounded-xl cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300">
                      <item.icon size={18} strokeWidth={1.8} />
                    </div>
                    <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-[11px] font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 shadow-lg">
                      {item.label} · inactive
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                    </div>
                  </div>
                );
              }
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
                  {/* Tooltip */}
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
            {sections.map((section, si) => (
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
                    if (item.inactive) {
                      return (
                        <div
                          key={item.to}
                          aria-disabled="true"
                          title={`${item.label} is currently inactive`}
                          className="relative group cursor-not-allowed"
                        >
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 0.6, x: 0 }}
                            transition={{ delay: si * 0.05 + i * 0.03, duration: 0.25 }}
                            className="flex items-center gap-3 h-[38px] px-3 rounded-xl text-[13px] font-medium text-slate-400"
                          >
                            <item.icon size={18} strokeWidth={1.6} className="flex-shrink-0 text-slate-300" />
                            <span className="truncate line-through decoration-slate-300/70">{item.label}</span>
                            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                              Inactive
                            </span>
                          </motion.div>
                        </div>
                      );
                    }
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-[11px] font-bold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-800 truncate leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize mt-1 leading-none">
                  {user?.role === 'admin' ? 'Admin' : user?.role} &middot; {user?.id}
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
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
