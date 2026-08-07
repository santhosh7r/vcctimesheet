import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vcc_vendor_token');
    if (token) {
      api.get('/auth/me')
        .then(data => setUser(data.user))
        .catch(() => { clearToken(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (clientId, subrole) => {
    try {
      const data = await api.post('/auth/login', { employeeId: clientId, role: 'client', subrole });
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
