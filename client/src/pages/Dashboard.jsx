import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, TrendingUp, BarChart3, Wallet,
  Package,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import { useIsMobile } from '../hooks/useIsMobile';
import { useCardFilters } from '../hooks/useCardFilters';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import FilterableCard from '../components/FilterableCard';
import CardFilterModal from '../components/CardFilterModal';
import { formatCurrency, formatPercent, CHART_COLORS } from '../utils/formatters';
import { fetchCustomers, fetchInventory } from '../services/api';
import {
  filterOrders,
  computeOrdersKpis,
  computeOrdersBySource,
  computeStatusBreakdown,
  computePaymentDistribution,
  computeRevenueOverTime,
  computeMultiSeriesRevenueOverTime,
} from '../utils/dashboardAggregations';

const TIME_LABELS = {
  all: 'All Time',
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 Days',
  last30: 'Last 30 Days',
  custom: 'Custom Range',
};

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

function SimpleGroupCard({ title, icon: Icon, iconBg, children }) {
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

/** Build the active chips array from an applied filter state. */
function buildActiveChips(applied, removeChip) {
  const chips = [];
  if (applied.timePreset && applied.timePreset !== 'all') {
    chips.push({
      key: 'time',
      label: TIME_LABELS[applied.timePreset] || applied.timePreset,
      color: 'terracotta',
      onRemove: () => removeChip('time', null),
    });
  }
  for (const s of applied.sources) {
    chips.push({ key: `src-${s}`, label: s, color: 'terracotta', onRemove: () => removeChip('source', s) });
  }
  for (const c of applied.customers) {
    chips.push({ key: `cust-${c.customerPhone}`, label: c.customerName, color: 'blue', onRemove: () => removeChip('customer', c.customerPhone) });
  }
  for (const p of applied.products) {
    chips.push({ key: `prod-${p.productName}`, label: p.productName, color: 'amber', onRemove: () => removeChip('product', p.productName) });
  }
  return chips;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, loading, error } = useDashboard();
  const isMobile = useIsMobile();

  // Master lists for customer / product pickers (fetched once; refreshed on mount)
  const [allCustomers, setAllCustomers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    fetchCustomers('', 'Active').then(setAllCustomers).catch(() => setAllCustomers([]));
    fetchInventory({ status: 'Active' }).then(setAllProducts).catch(() => setAllProducts([]));
  }, []);

  // One filter state per card
  const kpiFilters = useCardFilters();
  const sourceChartFilters = useCardFilters();
  const revenueChartFilters = useCardFilters();
  const statusChartFilters = useCardFilters();
  const paymentChartFilters = useCardFilters();

  // Per-card filtered order slices (memoized)
  const orders = data?.orders || [];

  const kpiOrders = useMemo(() => filterOrders(orders, kpiFilters.filterQuery), [orders, kpiFilters.filterQuery]);
  const sourceChartOrders = useMemo(() => filterOrders(orders, sourceChartFilters.filterQuery), [orders, sourceChartFilters.filterQuery]);
  const revenueChartOrders = useMemo(() => filterOrders(orders, revenueChartFilters.filterQuery), [orders, revenueChartFilters.filterQuery]);
  const statusChartOrders = useMemo(() => filterOrders(orders, statusChartFilters.filterQuery), [orders, statusChartFilters.filterQuery]);
  const paymentChartOrders = useMemo(() => filterOrders(orders, paymentChartFilters.filterQuery), [orders, paymentChartFilters.filterQuery]);

  const kpis = useMemo(() => computeOrdersKpis(kpiOrders), [kpiOrders]);
  const ordersBySource = useMemo(() => computeOrdersBySource(sourceChartOrders), [sourceChartOrders]);
  const statusBreakdown = useMemo(() => computeStatusBreakdown(statusChartOrders), [statusChartOrders]);
  const paymentDistribution = useMemo(() => computePaymentDistribution(paymentChartOrders), [paymentChartOrders]);

  // Revenue & Profit chart — decide single-series vs multi-series
  const revenueChart = useMemo(() => {
    const applied = revenueChartFilters.applied;
    const dims = [];
    if (applied.sources.length >= 2) dims.push({ groupBy: 'source', keys: applied.sources });
    if (applied.customers.length >= 2) dims.push({ groupBy: 'customer', keys: applied.customers.map(c => c.customerPhone), displayFn: (k) => {
      const match = applied.customers.find(c => c.customerPhone === k);
      return match ? match.customerName : k;
    } });
    if (applied.products.length >= 2) dims.push({ groupBy: 'product', keys: applied.products.map(p => p.productName) });

    if (dims.length === 1) {
      const dim = dims[0];
      const result = computeMultiSeriesRevenueOverTime(revenueChartOrders, {
        groupBy: dim.groupBy,
        selectedKeys: dim.keys,
        displayKeyFn: dim.displayFn || (k => k),
      });
      return { mode: 'multi', ...result };
    }
    // Default: single-series
    return { mode: 'single', data: computeRevenueOverTime(revenueChartOrders) };
  }, [revenueChartOrders, revenueChartFilters.applied]);

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const { inventoryKpis } = data;
  const pieLabel = isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

  // Chip builders (one per card)
  const kpiChips = buildActiveChips(kpiFilters.applied, kpiFilters.removeChip);
  const sourceChartChips = buildActiveChips(sourceChartFilters.applied, sourceChartFilters.removeChip);
  const revenueChartChips = buildActiveChips(revenueChartFilters.applied, revenueChartFilters.removeChip);
  const statusChartChips = buildActiveChips(statusChartFilters.applied, statusChartFilters.removeChip);
  const paymentChartChips = buildActiveChips(paymentChartFilters.applied, paymentChartFilters.removeChip);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* ── 1. Orders KPI Group ───────────────────────────────────────────── */}
      <FilterableCard
        title="Orders"
        icon={ShoppingBag}
        iconBg="bg-terracotta-50 text-terracotta-600"
        activeChips={kpiChips}
        filterCount={kpiFilters.activeCount}
        onOpenFilters={kpiFilters.openModal}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
          <StatItem label="Total Orders" value={kpis.totalOrders} to="/orders?tab=details" />
          <StatItem label="Total Revenue" value={formatCurrency(kpis.totalRevenue)} color="green" />
          <StatItem label="Total Profit" value={formatCurrency(kpis.totalProfit)} color="green" />
          <StatItem label="Avg Order Value" value={formatCurrency(kpis.avgOrderValue)} />
          <StatItem label="Return Rate" value={formatPercent(kpis.returnRate)} color="red" />
        </div>
      </FilterableCard>

      {/* ── 2. Charts Row A ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Orders by Source */}
        <FilterableCard
          title="Orders by Source"
          icon={BarChart3}
          iconBg="bg-terracotta-50 text-terracotta-600"
          activeChips={sourceChartChips}
          filterCount={sourceChartFilters.activeCount}
          onOpenFilters={sourceChartFilters.openModal}
        >
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
        </FilterableCard>

        {/* Revenue & Profit Over Time */}
        <FilterableCard
          title="Revenue & Profit Over Time"
          icon={TrendingUp}
          iconBg="bg-green-50 text-green-600"
          activeChips={revenueChartChips}
          filterCount={revenueChartFilters.activeCount}
          onOpenFilters={revenueChartFilters.openModal}
          headerExtra={revenueChart.mode === 'multi' && revenueChart.truncated ? (
            <p className="text-[11px] text-amber-600 mb-2">
              Showing first 5 of {revenueChart.truncatedCount} selected
            </p>
          ) : null}
        >
          <div className="h-[220px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: isMobile ? 9 : 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {revenueChart.mode === 'single' ? (
                  <>
                    <Line type="monotone" dataKey="revenue" stroke="#C8956C" strokeWidth={2} name="Revenue" dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" dot={false} />
                  </>
                ) : (
                  revenueChart.seriesKeys.flatMap((key, i) => {
                    const color = CHART_COLORS[i % CHART_COLORS.length];
                    return [
                      <Line
                        key={`${key}_rev`}
                        type="monotone"
                        dataKey={`${key}_rev`}
                        stroke={color}
                        strokeWidth={2}
                        name={`${key} Revenue`}
                        dot={false}
                      />,
                      <Line
                        key={`${key}_profit`}
                        type="monotone"
                        dataKey={`${key}_profit`}
                        stroke={color}
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        name={`${key} Profit`}
                        dot={false}
                      />,
                    ];
                  })
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FilterableCard>
      </div>

      {/* ── 3. Charts Row B ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Order Status Breakdown */}
        <FilterableCard
          title="Order Status Breakdown"
          icon={BarChart3}
          iconBg="bg-blue-50 text-blue-600"
          activeChips={statusChartChips}
          filterCount={statusChartFilters.activeCount}
          onOpenFilters={statusChartFilters.openModal}
        >
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
        </FilterableCard>

        {/* Payment Mode Distribution */}
        <FilterableCard
          title="Payment Mode Distribution"
          icon={Wallet}
          iconBg="bg-purple-50 text-purple-600"
          activeChips={paymentChartChips}
          filterCount={paymentChartFilters.activeCount}
          onOpenFilters={paymentChartFilters.openModal}
        >
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
        </FilterableCard>
      </div>

      {/* ── 4. Inventory (unfiltered) ─────────────────────────────────────── */}
      <SimpleGroupCard title="Inventory" icon={Package} iconBg="bg-amber-50 text-amber-600">
        <div className="grid grid-cols-3 gap-1">
          <StatItem label="Total" value={inventoryKpis.totalInventory ?? '—'} to="/inventory?tab=details" />
          <StatItem
            label="Low Stock"
            value={inventoryKpis.lowStockCount ?? '—'}
            to="/inventory?tab=details&stockFilter=lowStock"
            color="amber"
          />
          <StatItem
            label="Out of Stock"
            value={inventoryKpis.outOfStockCount ?? '—'}
            to="/inventory?tab=details&stockFilter=outOfStock"
            color="red"
          />
        </div>
      </SimpleGroupCard>

      {/* ── Filter Modals (one per card) ──────────────────────────────────── */}
      <CardFilterModal
        open={kpiFilters.isOpen}
        onClose={kpiFilters.closeModal}
        title="Filter: Orders KPIs"
        fields={{ time: true, source: true, customer: true, product: true }}
        pending={kpiFilters.pending}
        setPending={kpiFilters.setPending}
        allCustomers={allCustomers}
        allProducts={allProducts}
        onApply={kpiFilters.apply}
        onClear={kpiFilters.clearAll}
      />

      <CardFilterModal
        open={sourceChartFilters.isOpen}
        onClose={sourceChartFilters.closeModal}
        title="Filter: Orders by Source"
        fields={{ time: true, source: false, customer: true, product: true }}
        pending={sourceChartFilters.pending}
        setPending={sourceChartFilters.setPending}
        allCustomers={allCustomers}
        allProducts={allProducts}
        onApply={sourceChartFilters.apply}
        onClear={sourceChartFilters.clearAll}
      />

      <CardFilterModal
        open={revenueChartFilters.isOpen}
        onClose={revenueChartFilters.closeModal}
        title="Filter: Revenue & Profit"
        fields={{ time: true, source: true, customer: true, product: true }}
        pending={revenueChartFilters.pending}
        setPending={revenueChartFilters.setPending}
        allCustomers={allCustomers}
        allProducts={allProducts}
        multiSeriesHint
        onApply={revenueChartFilters.apply}
        onClear={revenueChartFilters.clearAll}
      />

      <CardFilterModal
        open={statusChartFilters.isOpen}
        onClose={statusChartFilters.closeModal}
        title="Filter: Order Status"
        fields={{ time: true, source: true, customer: true, product: true }}
        pending={statusChartFilters.pending}
        setPending={statusChartFilters.setPending}
        allCustomers={allCustomers}
        allProducts={allProducts}
        onApply={statusChartFilters.apply}
        onClear={statusChartFilters.clearAll}
      />

      <CardFilterModal
        open={paymentChartFilters.isOpen}
        onClose={paymentChartFilters.closeModal}
        title="Filter: Payment Mode"
        fields={{ time: true, source: true, customer: true, product: true }}
        pending={paymentChartFilters.pending}
        setPending={paymentChartFilters.setPending}
        allCustomers={allCustomers}
        allProducts={allProducts}
        onApply={paymentChartFilters.apply}
        onClear={paymentChartFilters.clearAll}
      />
    </div>
  );
}
