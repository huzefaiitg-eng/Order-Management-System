import { createContext, useContext, useState, useEffect } from 'react';
import { fetchProfile, login as apiLogin, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('oms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetchProfile()
      .then(setUser)
      .catch((err) => {
        // Only clear the token if it's actually invalid/expired (401).
        // Network errors or server 500s (e.g. cold start on Render) should
        // NOT log the user out — keep the token and let them retry.
        const msg = err?.message || '';
        if (msg.includes('Session expired') || msg.includes('Authentication required') || msg.includes('Invalid or expired token')) {
          localStorage.removeItem('oms_token');
          setUser(null);
        }
        // For any other error (network down, 500, etc.) just leave user as null
        // so ProtectedRoute redirects to login, but the token is preserved.
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await apiLogin(email, password);
    setUser(data.user);
    return data;
  }

  function logout() {
    setUser(null);
    apiLogout();
  }

  function updateUser(updates) {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
