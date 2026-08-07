import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, CheckCircle2, BarChart3, CalendarDays, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { supabase, useSupabase } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

export default function Analytics() {
  const [users, setUsers] = useState([]);
  const [leavesThisMonth, setLeavesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [requirements, setRequirements] = useState([]);

  useEffect(() => {
    setLoading(true);
    const [yr, mo] = period.split('-').map(Number);
    const monthStart = `${yr}-${String(mo).padStart(2, '0')}-01`;
    const monthEnd = `${yr}-${String(mo).padStart(2, '0')}-${new Date(yr, mo, 0).getDate()}`;

    Promise.all([
      api.get('/users?include_all=true'),
      // Fetch leaves that overlap with selected month
      (useSupabase && supabase
        ? supabase.from('leaves').select('start_date, end_date, status')
            .eq('status', 'approved')
            .lte('start_date', monthEnd)
            .gte('end_date', monthStart)
            .then(({ data, error }) => {
              if (error) console.warn('Leave query error:', error.message);
              let totalDays = 0;
              for (const l of (data || [])) {
                const start = new Date(Math.max(new Date(l.start_date), new Date(monthStart)));
                const end = new Date(Math.min(new Date(l.end_date), new Date(monthEnd)));
                totalDays += Math.max(1, Math.round((end - start) / 86400000) + 1);
              }
              return totalDays;
            })
        : Promise.resolve(0)
      ),
      api.get('/requirements').catch(() => ({ requirements: [] })),
    ]).then(([userData, leaveCount, reqsData]) => {
      setUsers(userData.users || []);
      setLeavesThisMonth(leaveCount);
      setRequirements(reqsData?.requirements || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  const activeUsers = useMemo(() => users.filter(u => u.is_active !== false), [users]);
  const totalEmployees = activeUsers.length;

  // Projects sorted by headcount descending
  const projectData = useMemo(() => {
    const counts = {};
    activeUsers.forEach(u => {
      if (u.project) {
        counts[u.project] = (counts[u.project] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeUsers]);

  // New employees for selected month + 6-month history
  const { newEmps, history } = useMemo(() => {
    const [yr, mo] = period.split('-').map(Number);
    const newEmps = users.filter(u => {
      if (!u.start_date) return false;
      const d = new Date(u.start_date);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });
    const history = [];
    for (let i = 5; i >= 0; i--) {
      const hDate = new Date(yr, mo - 1 - i, 1);
      const hYr = hDate.getFullYear();
      const hMo = hDate.getMonth() + 1;
      const count = users.filter(u => {
        if (!u.start_date) return false;
        const d = new Date(u.start_date);
        return d.getFullYear() === hYr && d.getMonth() + 1 === hMo;
      }).length;
      history.push({
        label: hDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count,
        isCurrent: i === 0,
      });
    }
    return { newEmps, history };
  }, [users, period]);

  const maxH = Math.max(...history.map(h => h.count), 1);
  const maxProject = Math.max(...projectData.map(p => p.count), 1);

  if (loading) {
    return (
      <div>
        <PageHeader icon={BarChart3} title="Analytics" subtitle="Workforce analytics and insights" />
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={BarChart3} title="Analytics" subtitle="Workforce analytics and insights" />

      <div className="mb-6">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500" />
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard icon={Users} label="Total Active" value={totalEmployees} color="blue" delay={0} />
        <StatCard icon={BarChart3} label="Projects" value={projectData.length} color="green" delay={0.05} />
        <StatCard icon={CalendarDays} label="Leaves This Month" value={leavesThisMonth} color="orange" delay={0.1} />
        <StatCard icon={UserPlus} label="New Joiners" value={newEmps.length} color="slate" delay={0.15} />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(() => {
          const empCount = activeUsers.filter(u => u.role === 'employee').length;
          const mgrCount = activeUsers.filter(u => u.role === 'manager').length;
          const admCount = activeUsers.filter(u => u.role === 'admin').length;
          const inactiveCount = users.length - activeUsers.length;
          return [
            { label: 'Employees', count: empCount, color: 'bg-slate-50 border-slate-200/60 text-slate-700' },
            { label: 'Managers', count: mgrCount, color: 'bg-purple-50 border-purple-200/60 text-purple-700' },
            { label: 'Admins', count: admCount, color: 'bg-primary-50 border-primary-200/60 text-primary-700' },
            { label: 'Inactive', count: inactiveCount, color: 'bg-red-50 border-red-200/60 text-red-700' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border p-2.5 ${card.color}`}>
              <p className="text-[18px] font-bold">{card.count}</p>
              <p className="text-[10px] font-medium opacity-70">{card.label}</p>
            </div>
          ));
        })()}
      </div>

      {/* New Employees This Month — full width */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
        className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">New Employees</h3>
          <span className="text-xs text-slate-400">{newEmps.length} this month</span>
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* Bar chart */}
          <div className="flex items-end gap-2" style={{ height: 144 }}>
            {history.map((h, i) => {
              const barH = Math.max(4, Math.round((h.count / maxH) * 120));
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] font-bold text-slate-700 tabular-nums mb-1">{h.count}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: barH }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className={`w-full rounded-t-md ${h.isCurrent ? 'bg-gradient-to-t from-primary-600 to-primary-400' : 'bg-gradient-to-t from-slate-300 to-slate-200'}`} />
                  <span className={`text-[9px] font-medium mt-1 ${h.isCurrent ? 'text-primary-600' : 'text-slate-400'}`}>{h.label}</span>
                </div>
              );
            })}
          </div>
          {/* List */}
          <div>
            {newEmps.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No new joiners this month</p>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {newEmps.map((e, i) => (
                  <motion.div key={e.id || i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-primary-600">{e.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-700">{e.name}</p>
                        <p className="text-[10px] text-slate-400">{e.designation || e.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{e.project || '-'}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Employees by Project — full width */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
        className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-700">Employees by Project</h3>
          <span className="text-xs text-slate-400">{projectData.length} projects</span>
        </div>
        <div className="space-y-3">
          {projectData.map((project, i) => (
            <motion.div key={project.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.04 }}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-700 font-medium">{project.name}</span>
                <span className="text-slate-500 tabular-nums font-medium">{project.count}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(project.count / maxProject) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600" />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
