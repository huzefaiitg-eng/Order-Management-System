import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Package, ShoppingBag, IndianRupee, RotateCcw, TrendingUp, Pencil, X, Check, Archive, Clock, BoxSelect } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import { fetchProductByArticleId, updateProduct, archiveProduct } from '../services/api';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { useCategories } from '../hooks/useCategories';
import StockBadge from '../components/StockBadge';
import StatusBadge from '../components/StatusBadge';
import ProductImage from '../components/ProductImage';
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
      imageUrls: product.productImages ? product.productImages.split(',').map(u => u.trim()).filter(Boolean) : [],
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
      const productImages = editForm.imageUrls.join(',');
      await updateProduct(articleId, {
        productName: editForm.productName,
        category: editForm.category,
        subCategory: editForm.subCategory,
        productCost: parseFloat(editForm.productCost),
        sellingPrice: parseFloat(editForm.sellingPrice),
        instockQuantity: parseInt(editForm.instockQuantity),
        productImages,
      });
      setProduct(prev => ({
        ...prev,
        productName: editForm.productName,
        category: editForm.category,
        subCategory: editForm.subCategory,
        productCost: parseFloat(editForm.productCost),
        sellingPrice: parseFloat(editForm.sellingPrice),
        instockQuantity: parseInt(editForm.instockQuantity),
        availableQuantity: parseInt(editForm.instockQuantity) - prev.quantityInActiveOrders,
        productImages,
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
    <DetailOverlay fallback="/inventory" title={product.productName}>
    <div className="p-4 md:p-6 space-y-5">

      {/* ─── Edit Mode ─── */}
      {editing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
          {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name</label>
              <input type="text" value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value, subCategory: '' })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sub Category</label>
                <select value={editForm.subCategory} onChange={e => setEditForm({ ...editForm, subCategory: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500">
                  <option value="">Select</option>
                  {(categorySubCategories[editForm.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-sm">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost Price</label>
              <input type="number" min="0" step="0.01" value={editForm.productCost} onChange={e => setEditForm({ ...editForm, productCost: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Selling Price</label>
              <input type="number" min="0" step="0.01" value={editForm.sellingPrice} onChange={e => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Instock Qty</label>
              <input type="number" min="0" value={editForm.instockQuantity} onChange={e => setEditForm({ ...editForm, instockQuantity: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
            </div>
          </div>
          <ImageUpload images={editForm.imageUrls} onChange={(urls) => setEditForm({ ...editForm, imageUrls: urls })} />
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
              <Check size={14} />{saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              <X size={14} />Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ─── View Mode: Gallery left + Details right on desktop ─── */
        <div className="flex flex-col md:flex-row gap-5">
          {/* Left — Image Gallery */}
          <div className="w-full md:w-1/2 md:sticky md:top-20 md:self-start">
            <ProductImage productImages={product.productImages} productName={product.productName} variant="gallery" iconSize={40} />
          </div>

          {/* Right — Product Info */}
          <div className="w-full md:w-1/2 space-y-4">
            {/* Name + actions */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{product.productName}</h1>
                <button onClick={startEditing} className="text-gray-400 hover:text-terracotta-600 transition-colors" title="Edit product">
                  <Pencil size={16} />
                </button>
                <button onClick={handleArchive} disabled={archiving} className="text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50" title="Archive product">
                  <Archive size={16} />
                </button>
              </div>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{product.articleId}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-terracotta-100 text-terracotta-800">
                {product.category}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {product.subCategory}
              </span>
              <StockBadge quantity={product.availableQuantity} />
            </div>

            {/* Description */}
            {product.productDescription && (
              <p className="text-sm text-gray-600 leading-relaxed">{product.productDescription}</p>
            )}

            {/* Price card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Selling Price</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(product.sellingPrice)}</p>
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <p className="text-xs text-gray-500 font-medium">Cost Price</p>
                  <p className="text-lg font-semibold text-gray-600">{formatCurrency(product.productCost)}</p>
                </div>
                {product.sellingPrice > product.productCost && (
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full self-center ml-auto">
                    {formatPercent(((product.sellingPrice - product.productCost) / product.productCost) * 100)} margin
                  </span>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Package size={18} className="text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">In Stock</p>
                  <p className="text-lg font-bold text-gray-900">{product.instockQuantity}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                <Clock size={18} className="text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Active Orders</p>
                  <p className="text-lg font-bold text-amber-700">{product.quantityInActiveOrders || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <BoxSelect size={18} className="text-purple-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Available</p>
                  <p className={`text-lg font-bold ${product.availableQuantity <= 0 ? 'text-red-600' : product.availableQuantity < 5 ? 'text-amber-600' : 'text-gray-900'}`}>{product.availableQuantity}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <ShoppingBag size={18} className="text-terracotta-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Total Orders</p>
                  <p className="text-lg font-bold text-gray-900">{product.totalOrders}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <TrendingUp size={18} className="text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(product.totalRevenue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <RotateCcw size={18} className="text-red-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Return Rate</p>
                  <p className="text-lg font-bold text-gray-900">{formatPercent(product.returnRate * 100)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Orders Table ─── */}
      {!editing && (
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
      )}
    </div>
    </DetailOverlay>
  );
}
