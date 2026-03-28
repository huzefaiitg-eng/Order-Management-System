import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Package, AlertTriangle, PackageX, IndianRupee } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { fetchInventorySummary } from '../services/api';
import { formatCurrency, PRODUCT_CATEGORIES } from '../utils/formatters';
import StockBadge from '../components/StockBadge';
import KpiCard from '../components/KpiCard';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

const SUB_CATEGORIES = ['Casual Wear', 'Office Wear', 'Party Wear', 'Sports', 'Ethnic', 'Daily Wear'];

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [filters, setFilters] = useState({});
  const { products, loading, error, refresh } = useInventory(filters);
  const [summary, setSummary] = useState(null);

  const [sortField, setSortField] = useState('productName');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    fetchInventorySummary().then(setSummary).catch(() => {});
  }, []);

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

  let sorted = [...products];
  if (sortField) {
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={() => { refresh(); fetchInventorySummary().then(setSummary); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard title="Total Products" value={summary.totalProducts} icon={Package} color="indigo" />
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
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>
        <select
          value={category}
          onChange={e => handleFilterChange('category', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={subCategory}
          onChange={e => handleFilterChange('subCategory', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
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
                      <Link
                        to={`/inventory/${encodeURIComponent(product.articleId)}`}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View
                      </Link>
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
    </div>
  );
}
