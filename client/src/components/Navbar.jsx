import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Lightbulb, Users, Package } from 'lucide-react';
import logo from '../assets/logo.png';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/insights', label: 'Insights', icon: Lightbulb },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="bg-brand-black border-b border-gray-800 px-6 py-3 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/">
          <img src={logo} alt="Bombay Stride" className="h-8" />
        </Link>
        <div className="flex gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === path
                  ? 'bg-terracotta-500/15 text-terracotta-500'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
