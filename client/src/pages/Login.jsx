import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, Wifi } from 'lucide-react';
import logo from '../assets/logo.png';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  // Pre-warm the backend as soon as the login page loads
  useEffect(() => {
    let cancelled = false;
    async function pingServer() {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (!res.ok) throw new Error('not ok');
      } catch {
        // Server might be sleeping — show a gentle notice and retry
        if (cancelled) return;
        setServerWaking(true);
        // Retry once after 5s to trigger the wake-up
        setTimeout(async () => {
          if (cancelled) return;
          try { await fetch(`${BASE_URL}/health`); } catch { /* ignore */ }
          if (!cancelled) setServerWaking(false);
        }, 5000);
      }
    }
    pingServer();
    return () => { cancelled = true; };
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Logo" className="h-10" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 text-center mb-6">Sign in to your account</h1>

          {serverWaking && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin shrink-0" />
              Server is starting up, this may take ~15 seconds on first load…
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-terracotta-600 text-white rounded-lg text-sm font-medium hover:bg-terracotta-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-400 text-center">
            Forgot your password? Contact admin at{' '}
            <a href="mailto:huzefa.iitg@gmail.com" className="text-terracotta-500 hover:underline">
              huzefa.iitg@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
