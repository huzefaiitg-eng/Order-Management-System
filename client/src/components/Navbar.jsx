import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Users, Package, User, LogOut, Menu, X, Settings, ChevronDown, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

const omsNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/orders',    label: 'Orders',    icon: ShoppingBag },
  { path: '/inventory', label: 'Inventory', icon: Package },
];

const crmNavItems = [
  { path: '/leads',     label: 'Leads',     icon: Target },
  { path: '/customers', label: 'Customers', icon: Users },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const desktopAvatarRef = useRef(null);
  const mobileAvatarRef = useRef(null);
  const switcherRef = useRef(null);
  const navRef = useRef(null);

  const isCRM = pathname.startsWith('/leads') || pathname.startsWith('/customers');
  const navItems = isCRM ? crmNavItems : omsNavItems;

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      const insideDesktop = desktopAvatarRef.current?.contains(e.target);
      const insideMobile = mobileAvatarRef.current?.contains(e.target);
      if (!insideDesktop && !insideMobile) setAvatarOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close product switcher on outside click
  useEffect(() => {
    function handleClick(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setSwitcherOpen(false);
  }, [pathname]);

  return (
    <nav ref={navRef} className="bg-brand-black border-b border-gray-800 sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 py-3">

        {/* Logo / Product Switcher */}
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen(o => !o)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <img src={logo} alt="Logo" className="h-7 sm:h-8" />
            <ChevronDown size={13} className="text-gray-500 mt-0.5" />
          </button>

          {switcherOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
              <button
                onClick={() => { navigate('/leads'); setSwitcherOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left ${isCRM ? 'bg-terracotta-50' : ''}`}
              >
                <span className="text-xl">🎯</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Lead Management</p>
                  <p className="text-xs text-gray-400">Leads · Customers</p>
                </div>
                {isCRM && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-terracotta-500" />}
              </button>
              <button
                onClick={() => { navigate('/dashboard'); setSwitcherOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left ${!isCRM ? 'bg-terracotta-50' : ''}`}
              >
                <span className="text-xl">📦</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Order Management</p>
                  <p className="text-xs text-gray-400">Orders · Inventory</p>
                </div>
                {!isCRM && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-terracotta-500" />}
              </button>
            </div>
          )}
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = isCRM
              ? pathname.startsWith(path)
              : pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-terracotta-500/15 text-terracotta-500'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}

          {/* Desktop avatar */}
          <div className="relative ml-4" ref={desktopAvatarRef}>
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-9 h-9 rounded-full bg-terracotta-500 text-white text-sm font-bold flex items-center justify-center hover:bg-terracotta-600 transition-colors"
            >
              {getInitials(user?.name)}
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User size={16} />
                  Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setAvatarOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings size={16} />
                  Settings
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: avatar + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <div className="relative" ref={mobileAvatarRef}>
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-8 h-8 rounded-full bg-terracotta-500 text-white text-xs font-bold flex items-center justify-center"
            >
              {getInitials(user?.name)}
            </button>
            {avatarOpen && (
              <div className="absolute right-0 top-11 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => { setAvatarOpen(false); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User size={16} />
                  Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => { setAvatarOpen(false); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings size={16} />
                  Settings
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-gray-300 hover:text-white p-1"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 px-4 py-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = isCRM ? pathname.startsWith(path) : pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-terracotta-500/15 text-terracotta-500'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
