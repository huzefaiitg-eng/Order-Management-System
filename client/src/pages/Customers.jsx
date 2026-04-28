import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, User, Phone, MapPin, Mail, ShoppingBag, Zap, Plus, X,
  Archive, SlidersHorizontal, ArrowUpDown, Lightbulb, Crown, UserX, Bell, RotateCcw,
} from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { useCustomerInsights } from '../hooks/useCustomerInsights';
import { addCustomer, archiveCustomer } from '../services/api';
import InsightSection from '../components/InsightSection';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency, formatPercent } from '../utils/formatters';

const BATCH_SIZE = 25;
const ORDER_BUCKETS = ['1', '2', '3', '4', '5', '5+'];
const SORT_OPTIONS = [
  { key: 'orders_desc', label: 'Total Orders (high → low)', sortField: 'totalOrders',      sortDir: 'desc' },
  { key: 'orders_asc',  label: 'Total Orders (low → high)', sortField: 'totalOrders',      sortDir: 'asc' },
  { key: 'name_asc',    label: 'Name: A–Z',                 sortField: 'customerName',     sortDir: 'asc' },
  { key: 'name_desc',   label: 'Name: Z–A',                 sortField: 'customerName',     sortDir: 'desc' },
  { key: 'active_desc', label: 'Most active orders',        sortField: 'activeOrderCount', sortDir: 'desc' },
];

function AddCustomerModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName || !form.customerPhone) { setError('Name and phone are required'); return; }
    setSaving(true); setError('');
    try { await addCustomer(form); onAdded(); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Customer name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input type="text" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Phone number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Email address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Delivery address" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab state — default to insights
  const activeTab = searchParams.get('tab') || 'insights';
  const hasActiveOrdersParam = searchParams.get('hasActiveOrders') === 'true';

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // Insights data — always fetch (shown in default tab)
  const { data: insightsData, loading: insightsLoading, error: insightsError } = useCustomerInsights();

  // Customer list data
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiving, setArchiving] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  // Filter flap state
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedActive, setAppliedActive] = useState(hasActiveOrdersParam);
  const [appliedOrderBuckets, setAppliedOrderBuckets] = useState([]);
  const [pendingActive, setPendingActive] = useState(hasActiveOrdersParam);
  const [pendingOrderBuckets, setPendingOrderBuckets] = useState([]);

  const { customers, loading, error, refresh } = useCustomers(query, 'Active', appliedActive);

  // Sort state
  const [sortField, setSortField] = useState('totalOrders');
  const [sortDir, setSortDir] = useState('desc');
  const [activeSort, setActiveSort] = useState('orders_desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef(null);

  // Lazy loading
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const activeFilterCount = (appliedActive ? 1 : 0) + appliedOrderBuckets.length;

  useEffect(() => {
    setAppliedActive(hasActiveOrdersParam);
    setPendingActive(hasActiveOrdersParam);
  }, [hasActiveOrdersParam]);

  useEffect(() => {
    function handleClick(e) { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setSortOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e) => { e.preventDefault(); setQuery(search); };

  const openFilterFlap = () => {
    setPendingActive(appliedActive);
    setPendingOrderBuckets([...appliedOrderBuckets]);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedActive(pendingActive);
    setAppliedOrderBuckets([...pendingOrderBuckets]);
    if (pendingActive !== hasActiveOrdersParam) {
      const next = new URLSearchParams(searchParams);
      if (pendingActive) next.set('hasActiveOrders', 'true'); else next.delete('hasActiveOrders');
      setSearchParams(next);
    }
    setFilterOpen(false);
  };

  const clearAllFilters = () => { setPendingActive(false); setPendingOrderBuckets([]); };

  const removeActiveChip = () => {
    setAppliedActive(false);
    const next = new URLSearchParams(searchParams);
    next.delete('hasActiveOrders');
    setSearchParams(next);
  };

  const removeBucketChip = (bucket) => setAppliedOrderBuckets(prev => prev.filter(b => b !== bucket));
  const toggleBucket = (bucket) => setPendingOrderBuckets(prev =>
    prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]);

  const handleSortSelect = (key) => {
    const opt = SORT_OPTIONS.find(o => o.key === key);
    if (!opt) return;
    setActiveSort(key); setSortField(opt.sortField); setSortDir(opt.sortDir); setSortOpen(false);
  };

  const handleArchive = (e, customer) => {
    e.preventDefault(); e.stopPropagation();
    setConfirmModal({
      title: 'Archive Customer',
      message: `Archive ${customer.customerName}? They will be moved to the archived customers list.`,
      confirmLabel: 'Archive',
      variant: 'warning',
      onConfirm: async () => {
        await archiveCustomer(customer.customerPhone);
        refresh();
        setConfirmModal(null);
      },
    });
  };

  const filteredByBucket = useMemo(() => {
    if (!appliedOrderBuckets.length) return customers;
    return customers.filter(c => {
      const n = c.totalOrders || 0;
      return appliedOrderBuckets.some(b => b === '5+' ? n > 5 : parseInt(b) === n);
    });
  }, [customers, appliedOrderBuckets]);

  const sorted = useMemo(() => {
    let list = [...filteredByBucket];
    if (sortField) {
      list.sort((a, b) => {
        let aVal = a[sortField], bVal = b[sortField];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = (bVal || '').toLowerCase();
        if (aVal == null) aVal = 0;
        if (bVal == null) bVal = 0;
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [filteredByBucket, sortField, sortDir]);

  const visibleCustomers = sorted.slice(0, visibleCount);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [query, appliedActive, appliedOrderBuckets, sortField, sortDir]);


  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customers</h1>
          <button onClick={refresh} className="p-1.5 rounded-lg text-gray-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/customers/archived" className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Archive size={16} />
            <span className="hidden md:inline">Archived</span>
          </Link>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
            <Plus size={16} />
            <span className="hidden md:inline">Add Customer</span>
          </button>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'insights', label: 'Insights', icon: Lightbulb },
          { key: 'details', label: 'All Customers', icon: User },
        ].map(tab => (
          <button key={tab.key} onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-terracotta-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}>
            <tab.icon size={15} />{tab.label}
          </button>
        ))}
      </div>

      {/* ─── Insights Tab ─── */}
      {activeTab === 'insights' && (
        <div className="space-y-5">
          {/* KPI Cards */}
          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-terracotta-50 text-terracotta-600"><User size={20} /></div>
                <div>
                  <p className="text-sm text-gray-500">Total Customers</p>
                  <p className="text-xl font-bold text-gray-900">{customers.length}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-green-50 text-green-600"><Zap size={20} /></div>
                <div>
                  <p className="text-sm text-gray-500">With Active Orders</p>
                  <p className="text-xl font-bold text-gray-900">{customers.filter(c => c.activeOrderCount > 0).length}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600"><ShoppingBag size={20} /></div>
                <div>
                  <p className="text-sm text-gray-500">Repeat Customers</p>
                  <p className="text-xl font-bold text-gray-900">{customers.filter(c => c.totalOrders > 1).length}</p>
                </div>
              </div>
            </div>
          )}
          {loading && <Loader />}

          {/* Insight Sections */}
          {insightsLoading && <Loader />}
          {insightsError && <ErrorMessage message={insightsError} />}
          {insightsData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <InsightSection icon={Crown} title="High-Value Customers" count={insightsData.highValueCustomers?.length || 0} color="green">
                {!insightsData.highValueCustomers?.length ? (
                  <p className="text-sm text-gray-500">No data available</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.highValueCustomers.map((c, i) => (
                      <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                            <p className="text-xs text-gray-500">{c.orderCount} orders</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-green-700">{formatCurrency(c.totalSpent)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>

              <InsightSection icon={UserX} title="Churn Risk" count={insightsData.churnRiskCustomers?.length || 0} color="red">
                {!insightsData.churnRiskCustomers?.length ? (
                  <p className="text-sm text-gray-500">No churn risk customers</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.churnRiskCustomers.map((c, i) => (
                      <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                          <p className="text-xs text-gray-500">Last order: {c.lastOrderDate}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{c.daysSinceLastOrder}d ago</p>
                          <p className="text-xs text-gray-500">{c.totalOrders} orders</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>

              <InsightSection icon={Bell} title="Attention Needed" count={insightsData.attentionNeededCustomers?.length || 0} color="amber">
                {!insightsData.attentionNeededCustomers?.length ? (
                  <p className="text-sm text-gray-500">All customers are on track</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.attentionNeededCustomers.map((c, i) => (
                      <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                          <p className="text-xs text-gray-500">{c.customerPhone}</p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
                          {c.delayedOrderCount} delayed
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>

              <InsightSection icon={RotateCcw} title="High Return Rate" count={insightsData.customerReturnRates?.length || 0} color="orange">
                {!insightsData.customerReturnRates?.length ? (
                  <p className="text-sm text-gray-500">No customers with high return rates</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.customerReturnRates.map((c, i) => (
                      <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                          <p className="text-xs text-gray-500">{c.totalOrders} orders, {c.returnedOrders} returned</p>
                        </div>
                        <p className="text-sm font-bold text-orange-700">{formatPercent(c.returnRate * 100)} return</p>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>
            </div>
          )}
        </div>
      )}

      {/* ─── All Customers Tab ─── */}
      {activeTab === 'details' && (
        <>
          {/* Search + Filter + Sort row */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative flex-1 md:flex-none md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search name, phone, email..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
            </form>
            <button onClick={openFilterFlap}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
              <SlidersHorizontal size={16} />
              <span className="hidden md:inline">Filters</span>
              {activeFilterCount > 0 && <span className="bg-terracotta-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
            </button>
            <div className="relative" ref={sortMenuRef}>
              <button onClick={() => setSortOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
                <ArrowUpDown size={16} />
                <span className="hidden sm:inline">Sort</span>
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-56 py-1">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => handleSortSelect(opt.key)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${activeSort === opt.key ? 'text-terracotta-600 font-medium' : 'text-gray-700'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter chips */}
          {(appliedActive || appliedOrderBuckets.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {appliedActive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                  <Zap size={11} /> Active Only
                  <button onClick={removeActiveChip} className="hover:text-green-900"><X size={12} /></button>
                </span>
              )}
              {appliedOrderBuckets.map(b => (
                <span key={`bkt-${b}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs rounded-full font-medium">
                  {b} order{b !== '1' ? 's' : ''}
                  <button onClick={() => removeBucketChip(b)} className="hover:text-amber-900"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          {loading && <Loader />}
          {error && <ErrorMessage message={error} />}

          {!loading && !error && (
            <>
              {/* Customer Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleCustomers.map((customer, i) => (
                  <Link key={i} to={`/customers/${encodeURIComponent(customer.customerPhone)}`}
                    className="group block bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-lg hover:border-terracotta-200 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center text-base sm:text-lg font-bold shrink-0">
                        {customer.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{customer.customerName}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={12} />{customer.customerPhone}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {customer.activeOrderCount > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">
                            {customer.activeOrderCount} active
                          </span>
                        )}
                        <button onClick={(e) => handleArchive(e, customer)} disabled={archiving === customer.customerPhone}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50" title="Archive">
                          <Archive size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {customer.customerEmail && (
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1.5"><Mail size={12} className="shrink-0" />{customer.customerEmail}</p>
                      )}
                      {customer.customerAddress && (
                        <p className="text-xs text-gray-500 flex items-start gap-1.5">
                          <MapPin size={12} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{customer.customerAddress}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-3 mt-3 border-t border-gray-100">
                      <span className="text-gray-500">Total Orders <span className="font-semibold text-gray-900">{customer.totalOrders}</span></span>
                      {customer.activeOrderCount > 0 && (
                        <span className="text-gray-500">Active <span className="font-semibold text-green-700">{customer.activeOrderCount}</span></span>
                      )}
                    </div>
                  </Link>
                ))}
                {visibleCustomers.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500 text-sm">No customers found</div>
                )}
              </div>

              {visibleCount < sorted.length && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setVisibleCount(c => c + BATCH_SIZE)}
                    className="px-4 py-2 text-sm text-terracotta-600 border border-terracotta-200 rounded-lg hover:bg-terracotta-50 transition-colors"
                  >
                    Load more ({sorted.length - visibleCount} remaining)
                  </button>
                </div>
              )}
              <div className="text-center text-sm text-gray-500 py-1">
                Showing {visibleCustomers.length} of {sorted.length} customer{sorted.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Filter Flap ─── */}
      {filterOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setFilterOpen(false)} />
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-xl border-b border-gray-200 animate-slide-down">
            <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <button type="button" onClick={() => setPendingActive(a => !a)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    pendingActive ? 'bg-green-50 border-green-300 text-green-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Zap size={14} /> Active Orders Only
                </button>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Total Orders</h3>
                <div className="flex flex-wrap gap-2">
                  {ORDER_BUCKETS.map(b => (
                    <button key={b} type="button" onClick={() => toggleBucket(b)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingOrderBuckets.includes(b) ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {b} {b === '1' ? 'order' : 'orders'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <button onClick={clearAllFilters} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Clear All</button>
                <button onClick={applyFilters} className="px-6 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 font-medium">Apply Filters</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onAdded={refresh} />}
      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}
    </div>
  );
}
