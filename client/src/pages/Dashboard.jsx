import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, IndianRupee, TrendingUp, BarChart3, RotateCcw,
  Calendar, Users, Package, X, Zap, AlertTriangle, PackageX,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { useIsMobile } from '../hooks/useIsMobile';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, formatPercent, CHART_COLORS } from '../utils/formatters';

const PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom' },
];

function getDateRange(preset, customRange) {
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  switch (preset) {
    case 'today':
      return { startDate: fmt(today), endDate: fmt(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'last7': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { startDate: fmt(d), endDate: fmt(today) };
    }
    case 'last30': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { startDate: fmt(d), endDate: fmt(today) };
    }
    case 'custom':
      if (customRange.startDate && customRange.endDate) {
        return { startDate: customRange.startDate, endDate: customRange.endDate };
      }
      return {};
    case 'all':
    default:
      return {};
  }
}

function formatPillDate(isoStr) {
  return new Date(isoStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Inline sub-components ────────────────────────────────────────────────────

function StatItem({ label, value, to, color }) {
  const colorClass =
    color === 'red' ? 'text-red-600' :
    color === 'amber' ? 'text-amber-600' :
    color === 'green' ? 'text-green-600' :
    'text-gray-900';

  const inner = (
    <div className={`p-2.5 rounded-lg ${to ? 'hover:bg-gray-50 cursor-pointer transition-colors' : ''}`}>
      <p className="text-xs text-gray-500 mb-0.5 leading-tight">{label}</p>
      <p className={`text-lg sm:text-xl font-bold leading-tight ${colorClass}`}>{value ?? '—'}</p>
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
}

function GroupCard({ title, icon: Icon, iconBg, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${iconBg}`}>
          <Icon size={15} className="opacity-80" />
        </div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="h-px bg-gray-100 mb-3" />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [preset, setPreset] = useState('all');
  const [pendingCustom, setPendingCustom] = useState({ startDate: '', endDate: '' });
  const [appliedCustom, setAppliedCustom] = useState({ startDate: '', endDate: '' });
  const [showPopover, setShowPopover] = useState(false);
  const [popoverSide, setPopoverSide] = useState('right');
  const isMobile = useIsMobile();
  const customBtnRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e) {
      if (customBtnRef.current && !customBtnRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Detect which side the popover should open when it becomes visible
  useEffect(() => {
    if (showPopover && customBtnRef.current) {
      const rect = customBtnRef.current.getBoundingClientRect();
      setPopoverSide(window.innerWidth - rect.right < 292 ? 'left' : 'right');
    }
  }, [showPopover]);

  function handlePresetClick(key) {
    setPreset(key);
    if (key !== 'custom') setShowPopover(false);
    else setShowPopover(prev => !prev);
  }

  function handleApply() {
    setAppliedCustom(pendingCustom);
    setShowPopover(false);
  }

  function resetToAllTime() {
    setPreset('all');
    setAppliedCustom({ startDate: '', endDate: '' });
    setPendingCustom({ startDate: '', endDate: '' });
    setShowPopover(false);
  }

  const filters = useMemo(() => getDateRange(preset, appliedCustom), [preset, appliedCustom]);
  const { data, loading, error } = useDashboard(filters);

  const pillRange = useMemo(() => {
    if (preset === 'last7' || preset === 'last30') return getDateRange(preset, {});
    if (preset === 'custom' && appliedCustom.startDate && appliedCustom.endDate) return appliedCustom;
    return null;
  }, [preset, appliedCustom]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const { kpis, ordersBySource, statusBreakdown, paymentDistribution, revenueOverTime } = data;

  const pieLabel = isMobile
    ? false
    : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header + Date Filter */}
      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>

        {/* Preset buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(({ key, label }) => {
            if (key === 'custom') {
              return (
                <div key="custom" className="relative" ref={customBtnRef}>
                  <button
                    onClick={() => handlePresetClick('custom')}
                    className={`px-2.5 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                      preset === 'custom'
                        ? 'bg-terracotta-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                  {showPopover && (
                    <div
                      className={`absolute ${popoverSide === 'right' ? 'left-0' : 'right-0'} top-10 z-30 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72`}
                    >
                      <p className="text-sm font-semibold text-gray-800 mb-3">Select date range</p>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
                          <input
                            type="date"
                            value={pendingCustom.startDate}
                            onChange={e => setPendingCustom(r => ({ ...r, startDate: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
                          <input
                            type="date"
                            value={pendingCustom.endDate}
                            min={pendingCustom.startDate || undefined}
                            onChange={e => setPendingCustom(r => ({ ...r, endDate: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleApply}
                        disabled={!pendingCustom.startDate || !pendingCustom.endDate}
                        className="mt-4 w-full py-2 bg-terracotta-600 text-white text-sm font-medium rounded-lg hover:bg-terracotta-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={key}
                onClick={() => handlePresetClick(key)}
                className={`px-2.5 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                  preset === key
                    ? 'bg-terracotta-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Active date range pill */}
        {pillRange && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-terracotta-50 border border-terracotta-200 text-terracotta-700 text-xs sm:text-sm rounded-full px-3 py-1 font-medium">
              <Calendar size={13} />
              {formatPillDate(pillRange.startDate)} → {formatPillDate(pillRange.endDate)}
              <button onClick={resetToAllTime} className="ml-1 hover:text-terracotta-900 flex items-center" aria-label="Clear date filter">
                <X size={13} />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ── KPI Groups ──────────────────────────────────────────────────────── */}

      {/* Orders Group — full width */}
      <GroupCard title="Orders" icon={ShoppingBag} iconBg="bg-terracotta-50 text-terracotta-600">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
          <StatItem label="Total Orders" value={kpis.totalOrders} to="/orders" />
          <StatItem label="Total Revenue" value={formatCurrency(kpis.totalRevenue)} color="green" />
          <StatItem label="Total Profit" value={formatCurrency(kpis.totalProfit)} color="green" />
          <StatItem label="Avg Order Value" value={formatCurrency(kpis.avgOrderValue)} />
          <StatItem label="Return Rate" value={formatPercent(kpis.returnRate)} color="red" />
        </div>
      </GroupCard>

      {/* Customers + Inventory Groups — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Customers Group */}
        <GroupCard title="Customers" icon={Users} iconBg="bg-blue-50 text-blue-600">
          <div className="grid grid-cols-3 gap-1">
            <StatItem label="Total" value={kpis.totalCustomers ?? '—'} to="/customers" />
            <StatItem
              label="Active"
              value={kpis.activeCustomers ?? '—'}
              to="/customers?hasActiveOrders=true"
              color="green"
            />
            <StatItem
              label="New (7 days)"
              value={kpis.newCustomers7d ?? '—'}
              to="/customers"
            />
          </div>
        </GroupCard>

        {/* Inventory Group */}
        <GroupCard title="Inventory" icon={Package} iconBg="bg-amber-50 text-amber-600">
          <div className="grid grid-cols-3 gap-1">
            <StatItem label="Total" value={kpis.totalInventory ?? '—'} to="/inventory" />
            <StatItem
              label="Low Stock"
              value={kpis.lowStockCount ?? '—'}
              to="/inventory?stockFilter=lowStock"
              color="amber"
            />
            <StatItem
              label="Out of Stock"
              value={kpis.outOfStockCount ?? '—'}
              to="/inventory?stockFilter=outOfStock"
              color="red"
            />
          </div>
        </GroupCard>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Orders by Source</h2>
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersBySource}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Orders" radius={[4, 4, 0, 0]}>
                  {ordersBySource.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Revenue & Profit Over Time</h2>
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: isMobile ? 9 : 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#C8956C" strokeWidth={2} name="Revenue" dot={false} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Order Status Breakdown</h2>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={isMobile ? 40 : 60}
                  outerRadius={isMobile ? 75 : 110}
                  dataKey="value"
                  nameKey="name"
                  label={pieLabel}
                  labelLine={false}
                >
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                {isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Payment Mode Distribution</h2>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobile ? 75 : 110}
                  dataKey="value"
                  nameKey="name"
                  label={pieLabel}
                  labelLine={false}
                >
                  {paymentDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                {isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
