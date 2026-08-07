import { useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Users, Clock, UserMinus, RefreshCw, CheckCircle, AlertTriangle, LayoutDashboard, DollarSign } from 'lucide-react';
import { useTimesheets } from '../../context/TimesheetContext';
import { getFortnightlyPeriods, getDaysInRange, isNonWorkingDay } from '../../data/mockData';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import SortableHeader, { sortData } from '../../components/SortableHeader';

export default function ConsolidatorDashboard() {
  const { getAllTimesheets, frozenPeriods, employees: allEmployees, projects: PROJECTS } = useTimesheets();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const allTs = getAllTimesheets();
  const employees = allEmployees;

  const [sowData, setSowData] = useState([]);
  const [leavesData, setLeavesData] = useState([]);

  useEffect(() => {
    api.get('/sow-resources').then(d => setSowData(d.resources || [])).catch(() => {});
    api.get('/leaves').then(d => setLeavesData(d.leaves || [])).catch(() => {});
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sharepoint/sync', { method: 'POST' });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!data) {
        setSyncResult({ success: false, message: 'SharePoint sync is only available in production (Vercel).' });
      } else if (res.ok) {
        setSyncResult({ success: true, message: `Synced ${data.synced} timesheets (${data.failed} failed)` });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setSyncResult({ success: false, message: data.error || 'Sync failed' });
      }
    } catch (err) {
      setSyncResult({ success: false, message: err.message });
    } finally {
      setSyncing(false);
    }
  }, []);

  const activeUsers = useMemo(() => employees.filter(u => u.is_active !== false), [employees]);
  const roleCounts = useMemo(() => ({
    total: activeUsers.length,
    employees: activeUsers.filter(u => u.role === 'employee').length,
    managers: activeUsers.filter(u => u.role === 'manager').length,
    admins: activeUsers.filter(u => u.role === 'admin').length,
    consultants: activeUsers.filter(u => u.role === 'consultant').length,
    inactive: employees.length - activeUsers.length,
  }), [employees, activeUsers]);

  const stats = useMemo(() => {
    // Billable = active employees who have a matching SOW resource
    const activeEmpNames = new Set(activeUsers.map(u => u.name.toLowerCase().trim()));
    const sowNames = new Set(sowData.filter(r => r.status === 'Active' && r.sow_number).map(r => (r.name || '').toLowerCase().trim()));
    const billable = activeUsers.filter(u => sowNames.has(u.name.toLowerCase().trim())).length;
    const nonBillable = activeUsers.length - billable;
    const benchCount = employees.filter(u => u.employee_status === 'bench' || u.is_archived).length;
    return { billable, nonBillable, benchCount };
  }, [activeUsers, employees, sowData]);

  const projectSummary = useMemo(() => {
    const summary = {};
    PROJECTS.forEach((p) => { summary[p] = { total: 0, offshore: 0, onsite: 0, leaveDays: 0 }; });
    // Count employees by location per project
    activeUsers.forEach((emp) => {
      if (summary[emp.project]) {
        summary[emp.project].total++;
        const locType = (emp.location_type || '').toLowerCase();
        if (locType.includes('onsite')) {
          summary[emp.project].onsite++;
        } else {
          summary[emp.project].offshore++;
        }
      }
    });
    // Count leave days per project (from approved leaves this month)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    leavesData.forEach(leave => {
      if (leave.status !== 'approved') return;
      const startDate = new Date(leave.start_date);
      if (startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
        const emp = activeUsers.find(u => u.id === leave.user_id);
        if (emp && summary[emp.project]) {
          summary[emp.project].leaveDays += leave.days_count || 0;
        }
      }
    });
    return Object.entries(summary).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total);
  }, [activeUsers, leavesData, PROJECTS]);

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Overview across all projects and teams"
        icon={LayoutDashboard}
        actions={
          <button
            onClick={handleSync}
            disabled={syncing}
            className="h-9 px-4 rounded-xl text-[13px] font-medium bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:opacity-90 transition-all flex items-center gap-1.5 shadow-lg shadow-primary-600/25 disabled:opacity-50"
          >
            <RefreshCw size={14} strokeWidth={2} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync SharePoint'}
          </button>
        }
      />

      {/* Sync Result */}
      {syncResult && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-5 px-4 py-3 rounded-xl border flex items-center gap-2.5 text-[13px] font-medium ${
            syncResult.success
              ? 'bg-accent-50 border-accent-200/60 text-accent-700'
              : 'bg-red-50 border-red-200/60 text-red-700'
          }`}
        >
          {syncResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {syncResult.message}
          {syncResult.success && <span className="text-[11px] font-normal ml-1">— reloading...</span>}
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Users} label="Total Active" value={roleCounts.total} color="blue" delay={0} />
        <StatCard icon={DollarSign} label="Billable" value={stats.billable} color="green" delay={0.06} />
        <StatCard icon={UserMinus} label="Non-Billable" value={stats.nonBillable} color="purple" delay={0.12} />
        <StatCard icon={Clock} label="Bench" value={stats.benchCount} color="orange" delay={0.18} />
      </div>
      <div className="grid grid-cols-5 gap-3 mb-7">
        {[
          { label: 'Employees', count: roleCounts.employees, color: 'bg-slate-50 border-slate-200/60 text-slate-700' },
          { label: 'Managers', count: roleCounts.managers, color: 'bg-purple-50 border-purple-200/60 text-purple-700' },
          { label: 'Admins', count: roleCounts.admins, color: 'bg-primary-50 border-primary-200/60 text-primary-700' },
          { label: 'Consultants', count: roleCounts.consultants, color: 'bg-cyan-50 border-cyan-200/60 text-cyan-700' },
          { label: 'Inactive', count: roleCounts.inactive, color: 'bg-red-50 border-red-200/60 text-red-700' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-2.5 ${card.color}`}>
            <p className="text-[18px] font-bold">{card.count}</p>
            <p className="text-[10px] font-medium opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Project Summary Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-slate-800">Project Summary</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Current billing period</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              {projectSummary.length} Projects
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <SortableHeader label="Project" sortKey="0" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Offshore" sortKey="offshore" currentSort={sort} onSort={setSort} align="right" />
                <SortableHeader label="Onsite" sortKey="onsite" currentSort={sort} onSort={setSort} align="right" />
                <SortableHeader label="Leave Days" sortKey="leaveDays" currentSort={sort} onSort={setSort} align="right" />
                <SortableHeader label="Total" sortKey="total" currentSort={sort} onSort={setSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortData(
                projectSummary.map(([project, data]) => ({ ...data, _name: project })),
                sort,
                { '0': (item) => item._name.toLowerCase(), offshore: (item) => item.offshore, onsite: (item) => item.onsite, leaveDays: (item) => item.leaveDays, total: (item) => item.total }
              ).map((data, i) => {
                const project = data._name;
                return (
                  <motion.tr
                    key={project}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200 group"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary-600">
                            {project.replace('VCC - ', '').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-[13px] font-medium text-slate-800">{project}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[13px] text-slate-500 text-right tabular-nums">{data.offshore}</td>
                    <td className="px-6 py-3.5 text-[13px] text-slate-500 text-right tabular-nums">{data.onsite}</td>
                    <td className="px-6 py-3.5 text-[13px] text-slate-500 text-right tabular-nums">{data.leaveDays > 0 ? `${data.leaveDays}d` : '-'}</td>
                    <td className="px-6 py-3.5 text-[13px] font-semibold text-slate-800 text-right tabular-nums">{data.total}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
