import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, Package, RotateCcw, Trash2 } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { unarchiveProduct, deleteProduct } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

export default function ArchivedInventory() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: 'Archived' });
  const { products, loading, error, refresh } = useInventory(filters);
  const [actionLoading, setActionLoading] = useState(null);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ status: 'Archived', search });
  };

  const handleUnarchive = async (product) => {
    if (!window.confirm(`Unarchive "${product.productName}"? It will be moved back to the active inventory.`)) return;
    setActionLoading(product.articleId + '_unarchive');
    try {
      await unarchiveProduct(product.articleId);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Permanently delete "${product.productName}"? This cannot be undone and will remove it from the Google Sheet.`)) return;
    setActionLoading(product.articleId + '_delete');
    try {
      await deleteProduct(product.articleId);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Link to="/inventory" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} />
        Back to Active Inventory
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Archived Inventory</h1>
        <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {!loading && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <Package size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            {products.length} archived product{products.length !== 1 ? 's' : ''}. Unarchive to restore or permanently delete.
          </p>
        </div>
      )}

      <form onSubmit={handleSearch} className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search archived products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
        />
      </form>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Article ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cost</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">In Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.articleId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{product.articleId}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-700">{product.productName}</span>
                        {product.productDescription && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{product.productDescription}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(product.productCost)}</td>
                    <td className="px-4 py-3 text-gray-600 text-center">{product.instockQuantity}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUnarchive(product)}
                          disabled={actionLoading === product.articleId + '_unarchive'}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          <RotateCcw size={13} />
                          Unarchive
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          disabled={actionLoading === product.articleId + '_delete'}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No archived products</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {products.length} archived product{products.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
