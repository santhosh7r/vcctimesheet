import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SOWs from './pages/SOWs';
import Invoices from './pages/Invoices';
import Vendors from './pages/Vendors';
import NineBoxGrid from './pages/NineBoxGrid';
import Timesheets from './pages/Timesheets';
// The client Roster reuses the real admin page (the main AuthProvider +
// TimesheetProvider already wrap this portal). CTC auto-hides because there's
// no admin login in the client session.
import UserManagement from '../pages/consolidator/UserManagement';
import SOWManager from '../pages/consolidator/SOPManagement';

// The client/vendor portal, mounted inside the main app at /client/*.
// It runs its own auth (client login token) and layout, so it is fully
// self-contained — no separate dev server or deployment required.
// SOW Manager is a finance-only page — managers get redirected to their dashboard.
function FinanceOnly({ children }) {
  const { user } = useAuth();
  return user?.client_subrole === 'finance' ? children : <Navigate to="/client/dashboard" replace />;
}

export default function ClientApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/client/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sows" element={<SOWs />} />
          <Route path="sow-manager" element={<FinanceOnly><SOWManager clientView /></FinanceOnly>} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="roster" element={<UserManagement clientView />} />
          <Route path="nine-box" element={<NineBoxGrid />} />
        </Route>
        <Route path="*" element={<Navigate to="/client/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
