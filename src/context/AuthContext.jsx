import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken } from '../lib/api';

const AuthContext = createContext(null);

// Email + password login, restricted to a small allowlist on the server side.
// See /auth/email-login in supabaseApi.js for the allowed accounts.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  const emailLogin = useCallback(async (email, password, portal) => {
    setLoginError('');
    try {
      const data = await api.post('/auth/email-login', { email, password, portal });
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setLoginError(err?.message || 'Login failed');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // On load: restore an existing session, otherwise leave the user at /login.
  useEffect(() => {
    const token = localStorage.getItem('vcc_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(data => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, emailLogin, logout, loginError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
