import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Package, AlertTriangle, PackageX, IndianRupee, Plus, X, Archive } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { fetchInventorySummary, addProduct, archiveProduct } from '../services/api';
import { formatCurrency, PRODUCT_CATEGORIES } from '../utils/formatters';
import StockBadge from '../components/StockBadge';
import KpiCard from '../components/KpiCard';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

const SUB_CATEGORIES = ['Casual Wear', 'Office Wear', 'Party Wear', 'Sports', 'Ethnic', 'Daily Wear'];

function AddProductModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    productName: '', category: '', subCategory: '', productCost: '', instockQuantity: '', productDescription: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productName || !form.category || !form.subCategory || !form.productCost || !form.instockQuantity) {
      setError('Product name, category, sub-category, cost, and instock quantity are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addProduct({
        ...form,
        productCost: parseFloat(form.productCost),
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
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
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                <option value="">Select</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category *</label>
              <select value={form.subCategory} onChange={e => setForm({ ...form, subCategory: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                <option value="">Select</option>
                {SUB_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Instock Qty *</label>
              <input type="number" min="0" value={form.instockQuantity} onChange={e => setForm({ ...form, instockQuantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="0" />
            </div>
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
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [filters, setFilters] = useState({});
  const { products, loading, error, refresh } = useInventory(filters);
  const [summary, setSummary] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiving, setArchiving] = useState(null);

  const [sortField, setSortField] = useState('productName');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    fetchInventorySummary().then(setSummary).catch(() => {});
  }, []);

  const handleRefresh = () => {
    refresh();
    fetchInventorySummary().then(setSummary);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ search, category, subCategory });
  };

  const handleFilterChange = (field, value) => {
    const newFilters = { search, category, subCategory, [field]: value };
    if (field === 'category') setCategory(value);
    if (field === 'subCategory') setSubCategory(value);
    setFilters(newFilters);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleArchive = async (product) => {
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
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    if (stockFilter === 'lowStock') return list.filter(p => p.availableQuantity > 0 && p.availableQuantity < 5);
    if (stockFilter === 'outOfStock') return list.filter(p => p.instockQuantity === 0);
    return list;
  }, [products, sortField, sortDir, stockFilter]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-2">
          <Link to="/inventory/archived" className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Archive size={16} />
            Archived
          </Link>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
            <Plus size={16} />
            Add Product
          </button>
          <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors">
            <RefreshCw size={16} />
            Refresh
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
          />
        </form>
        <select
          value={category}
          onChange={e => handleFilterChange('category', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={subCategory}
          onChange={e => handleFilterChange('subCategory', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
        >
          <option value="">All Sub-Categories</option>
          {SUB_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                {sorted.map((product) => (
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
                          onClick={() => handleArchive(product)}
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
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">No products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {sorted.length} product{sorted.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onAdded={handleRefresh} />}
    </div>
  );
}
