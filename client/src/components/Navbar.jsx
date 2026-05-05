import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Users, Package, Target,
  ChevronLeft, ChevronRight, Menu, X, LogOut, User, Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

// ── Navigation structure ──────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Lead Management',
    items: [
      { path: '/leads/dashboard', label: 'Lead Dashboard', icon: LayoutDashboard },
      { path: '/leads',           label: 'Leads',          icon: Target },
      { path: '/customers',       label: 'Customers',      icon: Users  },
    ],
  },
  {
    label: 'Order Management',
    items: [
      { path: '/dashboard', label: 'Sales Dashboard', icon: LayoutDashboard },
      { path: '/orders',    label: 'Orders',          icon: ShoppingBag },
    ],
  },
  {
    label: 'Inventory Management',
    items: [
      { path: '/inventory', label: 'Inventory', icon: Package },
    ],
  },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

function isNavActive(pathname, path) {
  if (path === '/leads') return pathname === '/leads' || (pathname.startsWith('/leads/') && !pathname.startsWith('/leads/dashboard'));
  return pathname.startsWith(path);
}

// ── Single nav link ───────────────────────────────────────────────────────────
function NavItem({ path, label, icon: Icon, collapsed, pathname, onClick }) {
  const active = isNavActive(pathname, path);
  return (
    <Link
      to={path}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors
        ${collapsed ? 'justify-center py-2.5 px-2' : 'px-3 py-2.5'}
        ${active
          ? 'bg-terracotta-500/20 text-terracotta-200'
          : 'text-gray-400 hover:bg-white/10 hover:text-white'
        }`}
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

// ── Avatar button + dropdown ──────────────────────────────────────────────────
function AvatarMenu({ user, logout, dropdownDir = 'up-right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Dropdown position variants
  const dropPos =
    dropdownDir === 'up-right'  ? 'bottom-full left-0 mb-2'  :
    dropdownDir === 'up-left'   ? 'bottom-full right-0 mb-2' :
    dropdownDir === 'down-right'? 'top-full left-0 mt-2'     :
    'top-full right-0 mt-2'; // down-left (mobile)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full bg-terracotta-500 text-white text-xs font-bold flex items-center justify-center hover:bg-terracotta-600 transition-colors shrink-0"
      >
        {getInitials(user?.name)}
      </button>

      {open && (
        <div className={`absolute ${dropPos} w-52 bg-white rounded-xl border border-gray-200 shadow-xl py-2 z-[70]`}>
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <User size={16} /> Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings size={16} /> Settings
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared nav sections list ──────────────────────────────────────────────────
function NavSections({ collapsed, pathname, onItemClick }) {
  return (
    <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
      {NAV_SECTIONS.map((section, si) => (
        <div key={section.label}>
          {/* Section header */}
          {!collapsed ? (
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-1.5">
              {section.label}
            </p>
          ) : (
            si > 0 && <div className="border-t border-gray-800 mx-3 my-2" />
          )}
          {/* Items */}
          <div className="space-y-0.5">
            {section.items.map(item => (
              <NavItem
                key={item.path}
                {...item}
                collapsed={collapsed}
                pathname={pathname}
                onClick={onItemClick}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ── Main Navbar component ─────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // Sidebar collapse (desktop) — persisted in localStorage
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCollapse() {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }

  return (
    <>
      {/* ── DESKTOP SIDEBAR (hidden on mobile) ───────────────────────── */}
      <aside
        className={`hidden md:flex flex-col h-screen bg-brand-black border-r border-gray-800 shrink-0 transition-all duration-200
          ${collapsed ? 'w-16' : 'w-56'}`}
      >
        {/* Logo + collapse toggle */}
        <div
          className={`flex items-center h-14 shrink-0 border-b border-gray-800
            ${collapsed ? 'justify-center gap-1 px-1' : 'justify-between px-4'}`}
        >
          {collapsed ? (
            // Collapsed: favicon + chevron-right indicator side-by-side. Both expand on click.
            <button
              onClick={toggleCollapse}
              title="Expand sidebar"
              className="flex items-center gap-0.5 rounded-lg p-1 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <img src="/favicon.png" alt="Bombay Stride" className="h-6 w-6" />
              <ChevronRight size={14} />
            </button>
          ) : (
            // Expanded: full logo + chevron-left collapse button
            <>
              <img src={logo} alt="Bombay Stride" className="h-7" />
              <button
                onClick={toggleCollapse}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          )}
        </div>

        {/* Nav sections */}
        <NavSections collapsed={collapsed} pathname={pathname} onItemClick={null} />

        {/* User section */}
        <div className={`border-t border-gray-800 p-3 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <AvatarMenu user={user} logout={logout} dropdownDir="up-right" />
          ) : (
            <div className="flex items-center gap-2.5">
              <AvatarMenu user={user} logout={logout} dropdownDir="up-right" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate leading-tight mt-0.5">{user?.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── MOBILE TOP BAR (hidden on desktop) ───────────────────────── */}
      <header className="md:hidden flex items-center justify-between h-14 bg-brand-black border-b border-gray-800 px-4 shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <img src={logo} alt="Bombay Stride" className="h-7" />
        <AvatarMenu user={user} logout={logout} dropdownDir="down-left" />
      </header>

      {/* ── MOBILE DRAWER (fixed overlay) ────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-64 bg-brand-black flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-gray-800 shrink-0">
              <img src={logo} alt="Bombay Stride" className="h-7" />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X size={22} />
              </button>
            </div>
            {/* Nav sections */}
            <NavSections
              collapsed={false}
              pathname={pathname}
              onItemClick={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
