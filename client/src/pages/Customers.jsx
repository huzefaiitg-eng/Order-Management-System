import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, RefreshCw, User, Phone, MapPin, Mail, ShoppingBag, Zap, Plus, X, Archive, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { addCustomer, archiveCustomer } from '../services/api';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

const BATCH_SIZE = 25;

const ORDER_BUCKETS = ['1', '2', '3', '4', '5', '5+'];

const MOBILE_SORT_OPTIONS = [
  { key: 'orders_desc', label: 'Total Orders (high → low)', sortField: 'totalOrders',  sortDir: 'desc' },
  { key: 'name_asc',    label: 'Name: A–Z',                 sortField: 'customerName', sortDir: 'asc' },
  { key: 'name_desc',   label: 'Name: Z–A',                 sortField: 'customerName', sortDir: 'desc' },
];

function AddCustomerModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName || !form.customerPhone) {
      setError('Name and phone are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addCustomer(form);
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasActiveOrdersParam = searchParams.get('hasActiveOrders') === 'true';

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiving, setArchiving] = useState(null);

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
  const [mobileSort, setMobileSort] = useState('orders_desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef(null);

  // Lazy loading
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);

  const activeFilterCount = (appliedActive ? 1 : 0) + appliedOrderBuckets.length;

  // Sync URL param → filter state on navigation
  useEffect(() => {
    setAppliedActive(hasActiveOrdersParam);
    setPendingActive(hasActiveOrdersParam);
  }, [hasActiveOrdersParam]);

  // Close mobile sort dropdown on outside click
  useEffect(() => {
    function handleClick(e) { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setSortOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(search);
  };

  const openFilterFlap = () => {
    setPendingActive(appliedActive);
    setPendingOrderBuckets([...appliedOrderBuckets]);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedActive(pendingActive);
    setAppliedOrderBuckets([...pendingOrderBuckets]);
    // If active filter changed, update URL to match (keeps badge consistent)
    if (pendingActive !== hasActiveOrdersParam) {
      navigate(pendingActive ? '/customers?hasActiveOrders=true' : '/customers');
    }
    setFilterOpen(false);
  };

  const clearAllFilters = () => {
    setPendingActive(false);
    setPendingOrderBuckets([]);
  };

  const removeActiveChip = () => {
    setAppliedActive(false);
    if (hasActiveOrdersParam) navigate('/customers');
  };

  const removeBucketChip = (bucket) => {
    setAppliedOrderBuckets(prev => prev.filter(b => b !== bucket));
  };

  const toggleBucket = (bucket) => {
    setPendingOrderBuckets(prev =>
      prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]
    );
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleMobileSort = (key) => {
    const opt = MOBILE_SORT_OPTIONS.find(o => o.key === key);
    if (!opt) return;
    setMobileSort(key);
    setSortField(opt.sortField);
    setSortDir(opt.sortDir);
    setSortOpen(false);
  };

  const handleArchive = async (e, customer) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Archive ${customer.customerName}? They will be moved to the archived list.`)) return;
    setArchiving(customer.customerPhone);
    try {
      await archiveCustomer(customer.customerPhone);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setArchiving(null);
    }
  };

  // Client-side bucket filter
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
        let aVal = a[sortField];
        let bVal = b[sortField];
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

  // Reset visible count when filters/sort change
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [query, appliedActive, appliedOrderBuckets, sortField, sortDir]);

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(prev => Math.min(prev + BATCH_SIZE, sorted.length));
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sorted.length, visibleCount]);

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

      {/* Summary Cards */}
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

      {/* ─── Search + Filter + Sort row ─── */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 md:flex-none md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />
        </form>
        <button onClick={openFilterFlap}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
          <SlidersHorizontal size={16} />
          <span className="hidden md:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-terracotta-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
        {/* Mobile-only sort */}
        <div className="md:hidden relative" ref={sortMenuRef}>
          <button onClick={() => setSortOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
            <ArrowUpDown size={16} />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-56 py-1">
              {MOBILE_SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => handleMobileSort(opt.key)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${mobileSort === opt.key ? 'text-terracotta-600 font-medium' : 'text-gray-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Filter chips ─── */}
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
          {/* ─── Desktop Table ─── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      { key: 'customerName', label: 'Customer Name' },
                      { key: 'customerPhone', label: 'Phone Number' },
                      { key: 'customerEmail', label: 'Email' },
                      { key: 'customerAddress', label: 'Address' },
                      { key: 'totalOrders', label: 'Total Orders' },
                      { key: 'activeOrderCount', label: 'Active Orders' },
                      { key: null, label: '' },
                    ].map(col => (
                      <th
                        key={col.label || 'actions'}
                        onClick={() => col.key && handleSort(col.key)}
                        className={`px-4 py-3 text-left font-medium text-gray-600 ${col.key ? 'cursor-pointer hover:text-gray-900' : ''}`}
                      >
                        {col.label}
                        {sortField === col.key && (sortDir === 'asc' ? ' \u2191' : ' \u2193')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleCustomers.map((customer, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center text-xs font-bold">
                            {customer.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{customer.customerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone size={13} />
                          {customer.customerPhone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {customer.customerEmail ? (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Mail size={13} />
                            <span className="truncate max-w-[180px]">{customer.customerEmail}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5 text-gray-600 max-w-xs truncate">
                          <MapPin size={13} className="mt-0.5 shrink-0" />
                          <span className="truncate">{customer.customerAddress}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {customer.totalOrders}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {customer.activeOrderCount > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {customer.activeOrderCount}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/customers/${encodeURIComponent(customer.customerPhone)}`}
                            className="text-sm text-terracotta-600 hover:text-terracotta-800 font-medium"
                          >
                            View
                          </Link>
                          <button
                            onClick={(e) => handleArchive(e, customer)}
                            disabled={archiving === customer.customerPhone}
                            className="text-sm text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                            title="Archive customer"
                          >
                            <Archive size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleCustomers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No customers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Mobile Cards ─── */}
          <div className="md:hidden space-y-3">
            {visibleCustomers.map((customer, i) => (
              <Link
                key={i}
                to={`/customers/${encodeURIComponent(customer.customerPhone)}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {customer.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{customer.customerName}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1"><Phone size={11} />{customer.customerPhone}</p>
                  </div>
                  {customer.activeOrderCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800 shrink-0">
                      {customer.activeOrderCount} active
                    </span>
                  )}
                </div>
                {customer.customerEmail && (
                  <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5 mb-1">
                    <Mail size={11} className="shrink-0" />{customer.customerEmail}
                  </p>
                )}
                {customer.customerAddress && (
                  <p className="text-[11px] text-gray-500 flex items-start gap-1.5 mb-2">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span className="truncate">{customer.customerAddress}</span>
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-[11px] text-gray-500">Total Orders <span className="font-semibold text-gray-900">{customer.totalOrders}</span></span>
                </div>
              </Link>
            ))}
            {visibleCustomers.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No customers found</div>
            )}
          </div>

          {/* ─── Lazy load sentinel + count ─── */}
          {visibleCount < sorted.length && (
            <div ref={sentinelRef} className="py-4 text-center text-sm text-gray-400">Loading more...</div>
          )}
          <div className="text-center text-sm text-gray-500 py-1">
            Showing {visibleCustomers.length} of {sorted.length} customer{sorted.length !== 1 ? 's' : ''}
          </div>
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

              {/* Active Orders */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <button type="button" onClick={() => setPendingActive(a => !a)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    pendingActive
                      ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Zap size={14} />
                  Active Orders Only
                </button>
              </div>

              {/* Total Orders Buckets */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Total Orders</h3>
                <div className="flex flex-wrap gap-2">
                  {ORDER_BUCKETS.map(b => (
                    <button key={b} type="button" onClick={() => toggleBucket(b)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingOrderBuckets.includes(b)
                          ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {b} {b === '1' ? 'order' : 'orders'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <button onClick={clearAllFilters} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Clear All</button>
                <button onClick={applyFilters} className="px-6 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors font-medium">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onAdded={refresh} />}
    </div>
  );
}
