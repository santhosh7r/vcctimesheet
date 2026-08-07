import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Archive, ArchiveRestore, Users } from 'lucide-react';
import { useTimesheets } from '../../context/TimesheetContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import SortableHeader, { sortData } from '../../components/SortableHeader';

const REGIONS = ['Chennai', 'US', 'WFH(Chennai)', 'WFH(Hyderabad)', 'WFH(Bangalore)', 'WFH(Other)', 'UAE'];
const DESIGNATIONS = ['Employee', 'Consultant'];

export default function Employees() {
  const { user } = useAuth();
  const { employees: allUsers, projects: PROJECTS, archiveEmployee, updateEmployee } = useTimesheets();
  const USERS = allUsers.filter(u => u.project === user?.project);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  const filtered = (USERS || []).filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search);
    const matchProject = !projectFilter || u.project === projectFilter;
    const matchDesignation = !designationFilter || u.designation === designationFilter;
    const matchStatus = statusFilter === 'all' ? true
      : statusFilter === 'archived' ? u.is_archived
      : !u.is_archived;
    return matchSearch && matchProject && matchDesignation && matchStatus;
  });

  const archivedCount = (USERS || []).filter(u => u.is_archived).length;

  return (
    <div>
      <PageHeader icon={Users} title="Employees" subtitle="Current project history" />

      <Card className="mb-5 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID"
              className="w-full h-8 pl-9 pr-3 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
            />
          </div>
          <span className="h-8 px-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-[12px] text-slate-600 font-medium flex items-center">
            {user?.project || 'My Project'}
          </span>
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
          >
            <option value="">All Types</option>
            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border-2 border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
          >
            <option value="active">Active ({(USERS || []).length - archivedCount})</option>
            <option value="archived">Archived ({archivedCount})</option>
            <option value="all">All ({(USERS || []).length})</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-200/60 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-800">Employees' Current Project History</h2>
          <span className="text-[11px] text-slate-400">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={setSort} />
                <SortableHeader label="ID" sortKey="id" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Project" sortKey="project" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Start Date" sortKey="start_date" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Status" sortKey="is_archived" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Designation" sortKey="designation" currentSort={sort} onSort={setSort} />
                <SortableHeader label="Region" sortKey="region" currentSort={sort} onSort={setSort} />
                <th className="px-6 py-3 w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {sortData(filtered, sort).map((emp, i) => (
                <motion.tr
                  key={emp.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors group ${emp.is_archived ? 'opacity-60' : ''}`}
                >
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold ${
                        emp.is_archived
                          ? 'bg-gradient-to-br from-slate-400 to-slate-500'
                          : 'bg-gradient-to-br from-primary-500 to-primary-600'
                      }`}>
                        {emp.name.charAt(0)}
                      </div>
                      <span className="text-[13px] font-medium text-slate-800">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500 tabular-nums">{emp.id}</td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500">{emp.project}</td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500 tabular-nums">{emp.startDate || emp.start_date || '—'}</td>
                  <td className="px-6 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset ${
                      emp.is_archived
                        ? 'bg-slate-100 text-slate-500 ring-slate-300/30'
                        : 'bg-accent-50 text-accent-700 ring-accent-600/10'
                    }`}>
                      {emp.is_archived ? 'Archived' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500">{emp.designation || '—'}</td>
                  <td className="px-6 py-2.5 text-[12px] text-slate-500">{emp.region || '—'}</td>
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => archiveEmployee(emp.id, !emp.is_archived)}
                        title={emp.is_archived ? 'Restore employee' : 'Archive employee'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          emp.is_archived
                            ? 'text-slate-400 hover:text-accent-600 hover:bg-accent-50'
                            : 'text-slate-400 hover:text-warning-600 hover:bg-warning-50'
                        }`}
                      >
                        {emp.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
