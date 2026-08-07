import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TimesheetProvider } from './context/TimesheetContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Employee pages
import Timesheet from './pages/employee/Timesheet';
import History from './pages/employee/History';
import MyLeaves from './pages/employee/MyLeaves';
import MyTasks from './pages/employee/MyTasks';

// Manager pages
import ManagerDashboard from './pages/manager/Dashboard';
import Submissions from './pages/manager/Submissions';
import Employees from './pages/manager/Employees';
import Freeze from './pages/manager/Freeze';
import TaskManager from './pages/manager/TaskManager';
import LeaveApprovals from './pages/manager/LeaveApprovals';
import KPIDashboard from './pages/manager/KPIDashboard';
import MeetingMinutes from './pages/manager/MeetingMinutes';

// Admin/Consolidator pages
import ConsolidatorDashboard from './pages/consolidator/Dashboard';
import Reports from './pages/consolidator/Reports';
import Analytics from './pages/consolidator/Analytics';
import EmployeeProfiles from './pages/consolidator/EmployeeProfiles';
import LeaveOverview from './pages/consolidator/LeaveOverview';
import NineBoxGrid from './pages/consolidator/NineBoxGrid';
import SalesManagement from './pages/consolidator/SalesManagement';
import SOPManagement from './pages/consolidator/SOPManagement';
import AdminFreeze from './pages/consolidator/Freeze';
import AdminSubmissions from './pages/consolidator/Submissions';
import ClientTimesheets from './pages/consolidator/ClientTimesheets';
import AdminMeetings from './pages/manager/MeetingMinutes';
import MeetingNotesAI from './pages/consolidator/MeetingNotesAI';
import UserManagement from './pages/consolidator/UserManagement';
import SOWWorkflow from './pages/consolidator/SOWWorkflow';
import AuditLogs from './pages/consolidator/AuditLogs';

// Finance pages
import FinanceDashboard from './pages/finance/Dashboard';
import FinanceReports from './pages/finance/Reports';
import FinanceInvoices from './pages/finance/Invoices';
import FinanceBilling from './pages/finance/Billing';
import FinanceClients from './pages/finance/Clients';
import FinanceBench from './pages/finance/Bench';

// Shared pages
import HiringBoard from './pages/shared/HiringBoard';
import ClientApp from './client/ClientApp';
import EmployeeSalaries from './pages/shared/EmployeeSalaries';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TimesheetProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Employee */}
            <Route element={<Layout requiredRole="employee" />}>
              <Route path="/employee/timesheet" element={<Timesheet />} />
              <Route path="/employee/history" element={<History />} />
              <Route path="/employee/leaves" element={<MyLeaves />} />
              <Route path="/employee/tasks" element={<MyTasks />} />
              <Route path="/employee/hiring-board" element={<HiringBoard />} />
            </Route>

            {/* Manager */}
            <Route element={<Layout requiredRole="manager" />}>
              <Route path="/manager/dashboard" element={<ManagerDashboard />} />
              <Route path="/manager/submissions" element={<Submissions />} />
              <Route path="/manager/employees" element={<Employees />} />
              <Route path="/manager/freeze" element={<Freeze />} />
              <Route path="/manager/tasks" element={<TaskManager />} />
              <Route path="/manager/leaves" element={<LeaveApprovals />} />
              <Route path="/manager/kpi" element={<KPIDashboard />} />
              <Route path="/manager/meetings" element={<MeetingMinutes />} />
              <Route path="/manager/hiring-board" element={<HiringBoard />} />
            </Route>

            {/* Admin (Consolidator) */}
            <Route element={<Layout requiredRole="admin" />}>
              <Route path="/admin/dashboard" element={<ConsolidatorDashboard />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/analytics" element={<Analytics />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/employees" element={<Navigate to="/admin/users" replace />} />
              <Route path="/admin/salaries" element={<Navigate to="/admin/users" replace />} />
              <Route path="/admin/requirements" element={<Navigate to="/admin/hiring-board" replace />} />
              <Route path="/admin/leaves" element={<LeaveOverview />} />
              <Route path="/admin/sop" element={<SOPManagement />} />
              <Route path="/admin/submissions" element={<AdminSubmissions />} />
              <Route path="/admin/client-timesheets" element={<ClientTimesheets />} />
              <Route path="/admin/freeze" element={<AdminFreeze />} />
              <Route path="/admin/hiring-board" element={<HiringBoard />} />
              <Route path="/admin/audit-logs" element={<AuditLogs />} />
            </Route>

            {/* SOW Workflow — admin + finance + manager all see SOWs */}
            <Route element={<Layout requiredRoles={['admin', 'finance', 'manager']} />}>
              <Route path="/admin/sow-workflow" element={<SOWWorkflow />} />
              <Route path="/admin/ninebox" element={<NineBoxGrid />} />
            </Route>

            {/* Finance — also accessible to admin */}
            <Route element={<Layout requiredRoles={['finance', 'admin']} />}>
              <Route path="/finance/dashboard" element={<FinanceDashboard />} />
              <Route path="/finance/invoices" element={<FinanceInvoices />} />
              <Route path="/finance/billing" element={<FinanceBilling />} />
              <Route path="/finance/clients" element={<FinanceClients />} />
              <Route path="/finance/salaries" element={<EmployeeSalaries />} />
              <Route path="/finance/reports" element={<FinanceReports />} />
              <Route path="/finance/bench" element={<FinanceBench />} />
            </Route>

            {/* Client / Vendor portal — self-contained app mounted in-place */}
            <Route path="/client/*" element={<ClientApp />} />

            {/* Legacy redirects */}
            <Route path="/consolidator/*" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </TimesheetProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
