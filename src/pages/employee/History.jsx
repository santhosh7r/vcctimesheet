import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { History as HistoryIcon, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTimesheets } from '../../context/TimesheetContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

export default function History() {
  const { user } = useAuth();
  const { getUserTimesheets } = useTimesheets();

  const history = useMemo(() => {
    const ts = getUserTimesheets(user.id);
    return Object.entries(ts)
      .map(([period, data]) => ({
        period,
        status: data.status,
        totalHours: data.entries?.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0) || 0,
        updatedAt: data.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [user.id, getUserTimesheets]);

  return (
    <div>
      <PageHeader title="Submission History" subtitle="View all your past timesheet submissions" icon={HistoryIcon} />

      {history.length === 0 ? (
        <Card className="py-16">
          <EmptyState icon={FileSpreadsheet} title="No timesheets submitted yet" description="Your submission history will appear here once you submit a timesheet." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-[14px] font-bold text-slate-800">All Submissions</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{history.length} timesheet(s) found</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Project</th>
                  <th className="text-right px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Hours</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <motion.tr
                    key={h.period}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200"
                  >
                    <td className="px-6 py-3.5 text-[13px] font-semibold text-slate-800">{h.period}</td>
                    <td className="px-6 py-3.5">
                      <span className="text-[12px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        {user.project?.replace('VCC - ', '')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[14px] font-bold text-slate-800 text-right tabular-nums">{h.totalHours}h</td>
                    <td className="px-6 py-3.5"><StatusBadge status={h.status} /></td>
                    <td className="px-6 py-3.5 text-[12px] text-slate-400">
                      {new Date(h.updatedAt).toLocaleDateString()} {new Date(h.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
