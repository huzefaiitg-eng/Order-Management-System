import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Package, ShoppingBag, IndianRupee, RotateCcw, TrendingUp, Pencil, X, Check, Archive } from 'lucide-react';
import { fetchProductByArticleId, updateProduct, archiveProduct } from '../services/api';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { useCategories } from '../hooks/useCategories';
import StockBadge from '../components/StockBadge';
import StatusBadge from '../components/StatusBadge';
import DetailOverlay from '../components/DetailOverlay';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';

export default function ProductDetail() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { categories, categorySubCategories } = useCategories();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchProductByArticleId(articleId)
      .then(setProduct)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${product.productName}"? It will be moved to the archived list.`)) return;
    setArchiving(true);
    try {
      await archiveProduct(articleId);
      navigate('/inventory');
    } catch (err) {
      alert(err.message);
      setArchiving(false);
    }
  };

  const startEditing = () => {
    setEditForm({
      productName: product.productName,
      category: product.category,
      subCategory: product.subCategory,
      productCost: product.productCost,
      sellingPrice: product.sellingPrice,
      instockQuantity: product.instockQuantity,
    });
    setEditing(true);
    setEditError('');
  };

  const handleSave = async () => {
    if (!editForm.productName || !editForm.category || !editForm.subCategory) {
      setEditError('Product name, category, and sub-category are required');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await updateProduct(articleId, {
        ...editForm,
        productCost: parseFloat(editForm.productCost),
        sellingPrice: parseFloat(editForm.sellingPrice),
        instockQuantity: parseInt(editForm.instockQuantity),
      });
      setProduct(prev => ({
        ...prev,
        ...editForm,
        productCost: parseFloat(editForm.productCost),
        sellingPrice: parseFloat(editForm.sellingPrice),
        instockQuantity: parseInt(editForm.instockQuantity),
        availableQuantity: parseInt(editForm.instockQuantity) - prev.quantityInActiveOrders,
      }));
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DetailOverlay fallback="/inventory"><Loader /></DetailOverlay>;
  if (error) return <DetailOverlay fallback="/inventory"><ErrorMessage message={error} /></DetailOverlay>;
  if (!product) return null;

  return (
    <DetailOverlay fallback="/inventory">
    <div className="p-6 space-y-6">
      {/* Product Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-lg bg-terracotta-100 text-terracotta-700 flex items-center justify-center">
            <Package size={24} />
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Product Name</label>
                  <input type="text" value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full max-w-sm" />
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Category</label>
                    <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value, subCategory: '' })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sub Category</label>
                    <select value={editForm.subCategory} onChange={e => setEditForm({ ...editForm, subCategory: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                      <option value="">Select</option>
                      {(categorySubCategories[editForm.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cost Price</label>
                    <input type="number" min="0" step="0.01" value={editForm.productCost} onChange={e => setEditForm({ ...editForm, productCost: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-32" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Selling Price</label>
                    <input type="number" min="0" step="0.01" value={editForm.sellingPrice} onChange={e => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-32" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Instock Qty</label>
                    <input type="number" min="0" value={editForm.instockQuantity} onChange={e => setEditForm({ ...editForm, instockQuantity: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-32" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                    <Check size={14} />{saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    <X size={14} />Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">{product.productName}</h1>
                  <span className="text-xs font-mono text-gray-400">{product.articleId}</span>
                  <button onClick={startEditing} className="text-gray-400 hover:text-terracotta-600 transition-colors" title="Edit product">
                    <Pencil size={16} />
                  </button>
                  <button onClick={handleArchive} disabled={archiving} className="text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50" title="Archive product">
                    <Archive size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">{product.productDescription}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-terracotta-100 text-terracotta-800">
                    {product.category}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {product.subCategory}
                  </span>
                  <StockBadge quantity={product.availableQuantity} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 mt-6">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <IndianRupee size={18} className="text-gray-600" />
            <div>
              <p className="text-xs text-gray-500">Cost Price</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(product.productCost)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <IndianRupee size={18} className="text-terracotta-600" />
            <div>
              <p className="text-xs text-gray-500">Selling Price</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(product.sellingPrice)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Package size={18} className="text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">In Stock</p>
              <p className="text-lg font-bold text-gray-900">{product.instockQuantity}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <ShoppingBag size={18} className="text-terracotta-600" />
            <div>
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-lg font-bold text-gray-900">{product.totalOrders}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <TrendingUp size={18} className="text-green-600" />
            <div>
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(product.totalRevenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <RotateCcw size={18} className="text-red-600" />
            <div>
              <p className="text-xs text-gray-500">Return Rate</p>
              <p className="text-lg font-bold text-gray-900">{formatPercent(product.returnRate * 100)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Order History ({product.orders.length})
        </h2>
        {product.orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders for this product yet</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Price</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Profit</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {product.orders.map(order => (
                    <tr key={order.rowIndex} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{order.customerName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                          {order.orderFrom}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                      <td className={`px-4 py-3 font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(order.profit)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={order.orderStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </DetailOverlay>
  );
}
