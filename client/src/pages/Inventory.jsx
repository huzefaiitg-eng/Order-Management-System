import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Package, AlertTriangle, PackageX, IndianRupee, Plus, X, Archive, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import { useInventory } from '../hooks/useInventory';
import { fetchInventorySummary, addProduct, archiveProduct } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useCategories } from '../hooks/useCategories';
import StockBadge from '../components/StockBadge';
import ProductImage from '../components/ProductImage';
import KpiCard from '../components/KpiCard';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

const BATCH_SIZE = 25;

const SORT_OPTIONS = [
  { key: 'name_asc',    label: 'Name: A–Z',           sortField: 'productName',       sortDir: 'asc' },
  { key: 'name_desc',   label: 'Name: Z–A',           sortField: 'productName',       sortDir: 'desc' },
  { key: 'low_stock',   label: 'Low stock first',     sortField: 'availableQuantity', sortDir: 'asc' },
  { key: 'more_stock',  label: 'More stock first',    sortField: 'availableQuantity', sortDir: 'desc' },
  { key: 'expensive',   label: 'Price: High to low',  sortField: 'sellingPrice',      sortDir: 'desc' },
  { key: 'cheap',       label: 'Price: Low to high',  sortField: 'sellingPrice',      sortDir: 'asc' },
  { key: 'most_sold',   label: 'Most sold',           sortField: 'totalOrders',       sortDir: 'desc' },
];

function AddProductModal({ onClose, onAdded, categories, categorySubCategories }) {
  const [form, setForm] = useState({
    productName: '', category: '', subCategory: '', productCost: '', sellingPrice: '', instockQuantity: '', productDescription: '', imageUrls: [], minStock: '5', maxStock: '',
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
        productName: form.productName,
        category: form.category,
        subCategory: form.subCategory,
        productDescription: form.productDescription,
        productImages: form.imageUrls.join(','),
        productCost: parseFloat(form.productCost),
        sellingPrice: parseFloat(form.sellingPrice),
        instockQuantity: parseInt(form.instockQuantity),
        minStock: form.minStock ? parseInt(form.minStock) : 5,
        maxStock: form.maxStock ? parseInt(form.maxStock) : 0,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
              <input type="number" min="0" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="5" />
              <p className="text-[11px] text-gray-400 mt-0.5">Low-stock alert threshold</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock</label>
              <input type="number" min="0" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="0 = no cap" />
              <p className="text-[11px] text-gray-400 mt-0.5">Target max (0 = no cap)</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={form.productDescription} onChange={e => setForm({ ...form, productDescription: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Product description (optional)" />
          </div>
          <ImageUpload images={form.imageUrls} onChange={(urls) => setForm({ ...form, imageUrls: urls })} />
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
  const [activeSort, setActiveSort] = useState('name_asc');
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

  const handleSortSelect = (key) => {
    const opt = SORT_OPTIONS.find(o => o.key === key);
    if (!opt) return;
    setActiveSort(key);
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
    if (stockFilter === 'lowStock') return list.filter(p => p.availableQuantity > 0 && p.availableQuantity < (p.minStock || 5));
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
        {/* Sort dropdown */}
        <div className="relative" ref={sortMenuRef}>
          <button onClick={() => setSortOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
            <ArrowUpDown size={16} />
            <span className="hidden sm:inline">Sort</span>
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-52 py-1">
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
          {/* ─── Product Cards Grid ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProducts.map((product) => (
              <Link
                key={product.articleId}
                to={`/inventory/${encodeURIComponent(product.articleId)}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-terracotta-200 transition-all"
              >
                {/* Image area */}
                <div className="relative">
                  <ProductImage productImages={product.productImages} productName={product.productName} variant="card" />
                  <button
                    onClick={(e) => handleArchive(e, product)}
                    disabled={archiving === product.articleId}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm text-gray-500 hover:text-amber-600 hover:bg-white transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50"
                    title="Archive product"
                  >
                    <Archive size={14} />
                  </button>
                  <div className="absolute bottom-2 left-2">
                    <StockBadge quantity={product.availableQuantity} minStock={product.minStock} />
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3 sm:p-4">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{product.productName}</h3>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{product.articleId}</p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex px-2 py-0.5 rounded bg-terracotta-50 text-terracotta-700 text-[11px] font-medium">{product.category}</span>
                    <span className="text-[11px] text-gray-500 truncate">{product.subCategory}</span>
                  </div>

                  <p className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(product.sellingPrice)}</p>
                  <p className="text-[11px] text-gray-400">Cost {formatCurrency(product.productCost)}</p>

                  <div className="flex items-center justify-between text-[11px] pt-3 mt-3 border-t border-gray-100">
                    <span className="text-gray-500" title={`In Stock ${product.instockQuantity} − Active Units ${product.quantityInActiveOrders}`}>Available <span className="font-semibold text-gray-900">{product.availableQuantity}</span></span>
                    <span className="text-gray-500" title={`${product.quantityInActiveOrders} unit(s) committed`}>Active <span className="font-semibold text-gray-900">{product.activeOrderCount || 0}</span></span>
                    <span className="text-gray-500">Sold <span className="font-semibold text-gray-900">{product.totalOrders}</span></span>
                  </div>
                </div>
              </Link>
            ))}
            {visibleProducts.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500 text-sm">No products found</div>
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
