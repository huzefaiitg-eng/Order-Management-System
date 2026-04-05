import { createContext, useContext, useState, useEffect } from 'react';
import { fetchProfile, login as apiLogin, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

// Wrap a promise with a timeout so we never hang the loading screen forever
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('oms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    // Give the profile fetch up to 20 seconds (Render free-tier cold start).
    // If it times out or fails for a non-auth reason, keep the token so the
    // user can log in again without having to re-enter credentials.
    withTimeout(fetchProfile(), 20000)
      .then(setUser)
      .catch((err) => {
        const msg = err?.message || '';
        const isAuthError =
          msg.includes('Session expired') ||
          msg.includes('Authentication required') ||
          msg.includes('Invalid or expired token');
        if (isAuthError) {
          localStorage.removeItem('oms_token');
          setUser(null);
        }
        // For network errors, timeouts, or server 500s — keep the token;
        // user stays null → ProtectedRoute sends them to /login where they
        // can sign in again (token preserved so the page ping can wake server).
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
