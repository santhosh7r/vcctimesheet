import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SOWs from './pages/SOWs';
import Timesheets from './pages/Timesheets';
import Invoices from './pages/Invoices';
import Vendors from './pages/Vendors';
import Roster from './pages/Roster';
import NineBoxGrid from './pages/NineBoxGrid';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Root → dashboard (Layout bounces to /login if not authenticated) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sows" element={<SOWs />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/nine-box" element={<NineBoxGrid />} />
          </Route>

          {/* Legacy redirects for old /client/* paths */}
          <Route path="/client/dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/client/sows" element={<Navigate to="/sows" replace />} />
          <Route path="/client/timesheets" element={<Navigate to="/timesheets" replace />} />
          <Route path="/client/invoices" element={<Navigate to="/invoices" replace />} />
          <Route path="/client/vendors" element={<Navigate to="/vendors" replace />} />
          <Route path="/client/roster" element={<Navigate to="/roster" replace />} />

          {/* Unknown routes → dashboard; Layout sends unauthenticated users to /login */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
