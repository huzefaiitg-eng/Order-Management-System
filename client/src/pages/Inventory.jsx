import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Package, AlertTriangle, PackageX, IndianRupee, Plus, X, Archive, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { fetchInventorySummary, addProduct, archiveProduct } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useCategories } from '../hooks/useCategories';
import StockBadge from '../components/StockBadge';
import KpiCard from '../components/KpiCard';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

const BATCH_SIZE = 25;

const MOBILE_SORT_OPTIONS = [
  { key: 'name_asc',   label: 'Name: A–Z',          sortField: 'productName',       sortDir: 'asc' },
  { key: 'low_stock',  label: 'Low stock first',    sortField: 'availableQuantity', sortDir: 'asc' },
  { key: 'more_stock', label: 'More stock first',   sortField: 'availableQuantity', sortDir: 'desc' },
  { key: 'expensive',  label: 'Most expensive',     sortField: 'sellingPrice',      sortDir: 'desc' },
  { key: 'cheap',      label: 'Least expensive',    sortField: 'sellingPrice',      sortDir: 'asc' },
];

function AddProductModal({ onClose, onAdded, categories, categorySubCategories }) {
  const [form, setForm] = useState({
    productName: '', category: '', subCategory: '', productCost: '', sellingPrice: '', instockQuantity: '', productDescription: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productName || !form.category || !form.subCategory || !form.productCost || !form.sellingPrice || !form.instockQuantity) {
      setError('Product name, category, sub-category, cost, selling price, and instock quantity are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addProduct({
        ...form,
        productCost: parseFloat(form.productCost),
        sellingPrice: parseFloat(form.sellingPrice),
        instockQuantity: parseInt(form.instockQuantity),
      });
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
          <h2 className="text-lg font-bold text-gray-900">Add Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input type="text" value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Product name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, subCategory: '' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                <option value="">Select</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category *</label>
              <select value={form.subCategory} onChange={e => setForm({ ...form, subCategory: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                <option value="">Select</option>
                {(categorySubCategories[form.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price *</label>
              <input type="number" min="0" step="0.01" value={form.productCost} onChange={e => setForm({ ...form, productCost: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
              <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instock Qty *</label>
            <input type="number" min="0" value={form.instockQuantity} onChange={e => setForm({ ...form, instockQuantity: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={form.productDescription} onChange={e => setForm({ ...form, productDescription: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Product description (optional)" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const stockFilter = searchParams.get('stockFilter'); // 'lowStock' | 'outOfStock' | null

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const { products, loading, error, refresh } = useInventory(filters);
  const { categories, categorySubCategories } = useCategories();
  const [summary, setSummary] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiving, setArchiving] = useState(null);

  // Filter flap state
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedCategory, setAppliedCategory] = useState('');
  const [appliedSubCategory, setAppliedSubCategory] = useState('');
  const [pendingCategory, setPendingCategory] = useState('');
  const [pendingSubCategory, setPendingSubCategory] = useState('');

  // Sort state (desktop clicks columns; mobile dropdown writes here too)
  const [sortField, setSortField] = useState('productName');
  const [sortDir, setSortDir] = useState('asc');
  const [mobileSort, setMobileSort] = useState('name_asc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef(null);

  // Lazy loading
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);

  const activeFilterCount = (appliedCategory ? 1 : 0) + (appliedSubCategory ? 1 : 0);

  useEffect(() => {
    fetchInventorySummary().then(setSummary).catch(() => {});
  }, []);

  // Close mobile sort dropdown on outside click
  useEffect(() => {
    function handleClick(e) { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setSortOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleRefresh = () => {
    refresh();
    fetchInventorySummary().then(setSummary);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ search, category: appliedCategory, subCategory: appliedSubCategory });
  };

  const openFilterFlap = () => {
    setPendingCategory(appliedCategory);
    setPendingSubCategory(appliedSubCategory);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedCategory(pendingCategory);
    setAppliedSubCategory(pendingSubCategory);
    setFilters({ search, category: pendingCategory, subCategory: pendingSubCategory });
    setFilterOpen(false);
  };

  const clearAllFilters = () => {
    setPendingCategory('');
    setPendingSubCategory('');
  };

  const removeChip = (type) => {
    let nc = appliedCategory, ns = appliedSubCategory;
    if (type === 'category') { nc = ''; ns = ''; } // clearing category clears sub too
    if (type === 'subCategory') ns = '';
    setAppliedCategory(nc);
    setAppliedSubCategory(ns);
    setFilters({ search, category: nc, subCategory: ns });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
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

  const handleArchive = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Archive "${product.productName}"? It will be moved to the archived list.`)) return;
    setArchiving(product.articleId);
    try {
      await archiveProduct(product.articleId);
      refresh();
      fetchInventorySummary().then(setSummary);
    } catch (err) {
      alert(err.message);
    } finally {
      setArchiving(null);
    }
  };

  const sorted = useMemo(() => {
    let list = [...products];
    if (sortField) {
      list.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal == null) aVal = 0;
        if (bVal == null) bVal = 0;
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    if (stockFilter === 'lowStock') return list.filter(p => p.availableQuantity > 0 && p.availableQuantity < 5);
    if (stockFilter === 'outOfStock') return list.filter(p => p.instockQuantity === 0);
    return list;
  }, [products, sortField, sortDir, stockFilter]);

  const visibleProducts = sorted.slice(0, visibleCount);

  // Reset visible count when filters/sort change
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [filters, sortField, sortDir, stockFilter]);

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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Inventory</h1>
          <button onClick={handleRefresh} className="p-1.5 rounded-lg text-gray-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/inventory/archived" className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Archive size={16} />
            <span className="hidden md:inline">Archived</span>
          </Link>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
            <Plus size={16} />
            <span className="hidden md:inline">Add Product</span>
          </button>
        </div>
      </div>

      {/* Stock filter badge */}
      {stockFilter && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 font-medium border ${
            stockFilter === 'outOfStock'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {stockFilter === 'outOfStock' ? <PackageX size={12} /> : <AlertTriangle size={12} />}
            Showing: {stockFilter === 'outOfStock' ? 'Out of Stock' : 'Low Stock'} only
            <button
              onClick={() => navigate('/inventory')}
              className="ml-1 hover:opacity-70"
              aria-label="Clear filter"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard title="Total Products" value={summary.totalProducts} icon={Package} color="terracotta" />
          <KpiCard title="Inventory Value" value={formatCurrency(summary.totalInventoryValue)} icon={IndianRupee} color="green" />
          <KpiCard title="Low Stock" value={summary.lowStockCount} icon={AlertTriangle} color="amber" />
          <KpiCard title="Out of Stock" value={summary.outOfStockCount} icon={PackageX} color="red" />
        </div>
      )}

      {/* ─── Search + Filter + Sort row ─── */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 md:flex-none md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
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
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-52 py-1">
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
      {(appliedCategory || appliedSubCategory) && (
        <div className="flex flex-wrap gap-2">
          {appliedCategory && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-terracotta-50 text-terracotta-700 text-xs rounded-full font-medium">
              {appliedCategory} <button onClick={() => removeChip('category')} className="hover:text-terracotta-900"><X size={12} /></button>
            </span>
          )}
          {appliedSubCategory && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
              {appliedSubCategory} <button onClick={() => removeChip('subCategory')} className="hover:text-blue-900"><X size={12} /></button>
            </span>
          )}
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
                      { key: 'articleId', label: 'Article ID' },
                      { key: 'productName', label: 'Product Name' },
                      { key: 'category', label: 'Category' },
                      { key: 'subCategory', label: 'Sub Category' },
                      { key: 'productCost', label: 'Cost' },
                      { key: 'sellingPrice', label: 'Selling Price' },
                      { key: 'instockQuantity', label: 'In Stock' },
                      { key: 'quantityInActiveOrders', label: 'Active Orders' },
                      { key: 'availableQuantity', label: 'Available' },
                      { key: 'totalOrders', label: 'Total Sold' },
                      { key: null, label: '' },
                    ].map(col => (
                      <th
                        key={col.label || 'actions'}
                        onClick={() => col.key && handleSort(col.key)}
                        className={`px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-gray-900' : ''}`}
                      >
                        {col.label}
                        {sortField === col.key && (sortDir === 'asc' ? ' \u2191' : ' \u2193')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleProducts.map((product) => (
                    <tr key={product.articleId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.articleId}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-gray-900">{product.productName}</span>
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{product.productDescription}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-terracotta-50 text-terracotta-700 text-xs font-medium">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{product.subCategory}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(product.productCost)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(product.sellingPrice)}</td>
                      <td className="px-4 py-3 text-center font-medium">{product.instockQuantity}</td>
                      <td className="px-4 py-3 text-center">{product.quantityInActiveOrders}</td>
                      <td className="px-4 py-3">
                        <StockBadge quantity={product.availableQuantity} />
                        <span className="ml-2 text-xs text-gray-500">{product.availableQuantity}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {product.totalOrders}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/inventory/${encodeURIComponent(product.articleId)}`}
                            className="text-sm text-terracotta-600 hover:text-terracotta-800 font-medium"
                          >
                            View
                          </Link>
                          <button
                            onClick={(e) => handleArchive(e, product)}
                            disabled={archiving === product.articleId}
                            className="text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                            title="Archive product"
                          >
                            <Archive size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleProducts.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">No products found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Mobile Cards ─── */}
          <div className="md:hidden space-y-3">
            {visibleProducts.map(product => (
              <Link
                key={product.articleId}
                to={`/inventory/${encodeURIComponent(product.articleId)}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md active:bg-gray-50 transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{product.productName}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{product.articleId}</p>
                  </div>
                  <StockBadge quantity={product.availableQuantity} />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex px-2 py-0.5 rounded bg-terracotta-50 text-terracotta-700 text-[11px] font-medium">{product.category}</span>
                  <span className="text-[11px] text-gray-500 truncate">{product.subCategory}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-100">
                  <span className="text-gray-500">Selling <span className="font-semibold text-gray-900">{formatCurrency(product.sellingPrice)}</span></span>
                  <span className="text-gray-500">Stock <span className="font-semibold text-gray-900">{product.availableQuantity}</span></span>
                  <span className="text-gray-500">Sold <span className="font-semibold text-gray-900">{product.totalOrders}</span></span>
                </div>
              </Link>
            ))}
            {visibleProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No products found</div>
            )}
          </div>

          {/* ─── Lazy load sentinel + count ─── */}
          {visibleCount < sorted.length && (
            <div ref={sentinelRef} className="py-4 text-center text-sm text-gray-400">Loading more...</div>
          )}
          <div className="text-center text-sm text-gray-500 py-1">
            Showing {visibleProducts.length} of {sorted.length} product{sorted.length !== 1 ? 's' : ''}
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

              {/* Category */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <button key={c} type="button"
                      onClick={() => setPendingCategory(pendingCategory === c ? '' : c)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingCategory === c
                          ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub Category */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Sub Category</h3>
                <div className="flex flex-wrap gap-2">
                  {(pendingCategory
                    ? (categorySubCategories[pendingCategory] || [])
                    : [...new Set(Object.values(categorySubCategories).flat())]
                  ).map(s => (
                    <button key={s} type="button"
                      onClick={() => setPendingSubCategory(pendingSubCategory === s ? '' : s)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingSubCategory === s
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {s}
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

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onAdded={handleRefresh} categories={categories} categorySubCategories={categorySubCategories} />}
    </div>
  );
}
