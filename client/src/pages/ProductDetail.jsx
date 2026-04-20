import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, ShoppingBag, RotateCcw, TrendingUp, Pencil, X, Check, Archive, Clock, BoxSelect, Boxes, AlertTriangle, Plus, Minus, History } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import { fetchProductByArticleId, updateProduct, archiveProduct, adjustStock, fetchStockAudit } from '../services/api';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { parseCategories, joinCategories } from '../utils/categoryUtils';
import { useCategories } from '../hooks/useCategories';
import StockBadge from '../components/StockBadge';
import StatusBadge from '../components/StatusBadge';
import ProductImage from '../components/ProductImage';
import DetailOverlay from '../components/DetailOverlay';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import Toast from '../components/Toast';

const ADD_REASONS = ['New purchase', 'Supplier delivery', 'Return to inventory', 'Inventory correction', 'Other'];
const SUBTRACT_REASONS = ['Damaged goods', 'Shrinkage', 'Physical recount', 'Inventory correction', 'Other'];

export default function ProductDetail() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { categories, categorySubCategories } = useCategories();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode (product details — no stock qty)
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [archiving, setArchiving] = useState(false);

  // Manage Stock modal
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockTab, setStockTab] = useState('adjust'); // 'adjust' | 'audit'
  const [stockDirection, setStockDirection] = useState('+'); // '+' | '-'
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState(ADD_REASONS[0]);
  const [stockCustomReason, setStockCustomReason] = useState('');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState('');
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    setLoading(true);
    fetchProductByArticleId(articleId)
      .then(setProduct)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [articleId]);

  // Load audit on mount for the stock context section
  useEffect(() => {
    fetchStockAudit(articleId)
      .then(setAuditEntries)
      .catch(() => {});
  }, [articleId]);

  const loadAudit = () => {
    setAuditLoading(true);
    fetchStockAudit(articleId)
      .then(setAuditEntries)
      .catch(err => setStockError(err.message))
      .finally(() => setAuditLoading(false));
  };

  const openStockModal = () => {
    setStockTab('adjust');
    setStockDirection('+');
    setStockQty('');
    setStockReason(ADD_REASONS[0]);
    setStockCustomReason('');
    setStockError('');
    setStockModalOpen(true);
    loadAudit();
  };

  const handleDirectionChange = (dir) => {
    setStockDirection(dir);
    // Reset reason to first option of new direction
    setStockReason(dir === '+' ? ADD_REASONS[0] : SUBTRACT_REASONS[0]);
    setStockCustomReason('');
  };

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
      category: parseCategories(product.category),
      subCategory: parseCategories(product.subCategory),
      productCost: product.productCost,
      sellingPrice: product.sellingPrice,
      minStock: product.minStock ?? 5,
      maxStock: product.maxStock ?? 0,
      imageUrls: product.productImages ? product.productImages.split(',').map(u => u.trim()).filter(Boolean) : [],
    });
    setEditing(true);
    setEditError('');
  };

  const handleSave = async () => {
    if (!editForm.productName || !editForm.category.length || !editForm.subCategory.length) {
      setEditError('Product name, category, and sub-category are required');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const productImages = editForm.imageUrls.join(',');
      const updates = {
        productName: editForm.productName,
        category: joinCategories(editForm.category),
        subCategory: joinCategories(editForm.subCategory),
        productCost: parseFloat(editForm.productCost),
        sellingPrice: parseFloat(editForm.sellingPrice),
        minStock: parseInt(editForm.minStock) || 0,
        maxStock: parseInt(editForm.maxStock) || 0,
        productImages,
      };
      await updateProduct(articleId, updates);
      setProduct(prev => ({ ...prev, ...updates }));
      setEditing(false);
      setToast({ type: 'success', message: 'Product details updated successfully' });
    } catch (err) {
      setEditError(err.message);
      setToast({ type: 'error', message: err.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleStockSubmit = async () => {
    setStockError('');
    const raw = parseInt(stockQty);
    if (!Number.isFinite(raw) || raw <= 0) {
      setStockError('Enter a positive number');
      return;
    }
    const delta = stockDirection === '+' ? raw : -raw;
    const reason = stockReason === 'Other' ? stockCustomReason.trim() : stockReason;
    if (!reason) {
      setStockError('Reason is required');
      return;
    }

    // Max stock warning on addition
    if (stockDirection === '+' && product.maxStock > 0) {
      const projected = product.instockQuantity + raw;
      if (projected > product.maxStock) {
        const ok = window.confirm(
          `This will bring stock to ${projected} units, above your Max Stock target of ${product.maxStock}. Continue?`
        );
        if (!ok) return;
      }
    }

    setStockSaving(true);
    try {
      const updated = await adjustStock(articleId, {
        delta,
        reason,
        changeType: stockDirection === '+' ? 'restock' : 'adjust',
      });
      setProduct(prev => ({
        ...prev,
        instockQuantity: updated.instockQuantity,
        availableQuantity: updated.instockQuantity,
      }));
      const absQty = Math.abs(delta);
      setToast({ type: 'success', message: `Stock ${stockDirection === '+' ? 'increased' : 'reduced'} by ${absQty} unit${absQty !== 1 ? 's' : ''}` });
      setStockQty('');
      setStockCustomReason('');
      setStockTab('audit');
      loadAudit();
    } catch (err) {
      setStockError(err.message);
      setToast({ type: 'error', message: err.message || 'Failed to adjust stock' });
    } finally {
      setStockSaving(false);
    }
  };

  if (loading) return <DetailOverlay fallback="/inventory"><Loader /></DetailOverlay>;
  if (error) return <DetailOverlay fallback="/inventory"><ErrorMessage message={error} /></DetailOverlay>;
  if (!product) return null;

  const minStock = product.minStock ?? 5;
  const maxStock = product.maxStock ?? 0;
  const isLowStock = product.availableQuantity > 0 && product.availableQuantity < minStock;
  const isOutOfStock = product.availableQuantity <= 0;
  const isAboveMax = maxStock > 0 && product.instockQuantity > maxStock;
  const lastAudit = auditEntries.length > 0 ? auditEntries[auditEntries.length - 1] : null;
  const reasonOptions = stockDirection === '+' ? ADD_REASONS : SUBTRACT_REASONS;

  return (
    <DetailOverlay fallback="/inventory" title={product.productName}>
    <div className="p-4 md:p-6 space-y-5">

      {/* ─── View Mode (always shown) ─── */}
      <>
          {/* ─── Hero: Gallery left + Product Info right on desktop ─── */}
          <div className="flex flex-col md:flex-row gap-5">
            {/* Left — Image Gallery */}
            <div className="w-full md:w-[45%] md:sticky md:top-20 md:self-start">
              <ProductImage productImages={product.productImages} productName={product.productName} variant="gallery" iconSize={40} />
            </div>

            {/* Right — Core Product Info */}
            <div className="w-full md:w-[55%] space-y-4">
              {/* Name + Article ID + Action Buttons (inline on desktop) */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">{product.productName}</h1>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">{product.articleId}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil size={14} /> Edit Details
                  </button>
                  <button
                    onClick={handleArchive}
                    disabled={archiving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-amber-700 hover:border-amber-300 disabled:opacity-50"
                  >
                    <Archive size={14} /> {archiving ? 'Archiving...' : 'Archive'}
                  </button>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {parseCategories(product.category).map(c => (
                  <span key={c} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-terracotta-100 text-terracotta-800">{c}</span>
                ))}
                {parseCategories(product.subCategory).map(s => (
                  <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{s}</span>
                ))}
                <StockBadge quantity={product.availableQuantity} minStock={minStock} />
              </div>

              {/* Description */}
              {product.productDescription && (
                <p className="text-sm text-gray-600 leading-relaxed">{product.productDescription}</p>
              )}

              {/* Price card */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
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

              {/* Min / Max stock thresholds (product settings) */}
              <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
                <span>Min Stock: <span className="font-semibold text-gray-700">{minStock}</span></span>
                <span className="text-gray-300">·</span>
                <span>Max Stock: <span className="font-semibold text-gray-700">{maxStock > 0 ? maxStock : 'No cap'}</span></span>
              </div>
            </div>
          </div>

          {/* ─── Full-width Stats Grid ─── */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
              <Package size={18} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">In Stock</p>
                <p className="text-lg font-bold text-gray-900">{product.instockQuantity}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-lg" title={`${product.quantityInActiveOrders || 0} unit(s) committed across active orders`}>
              <Clock size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Active Orders</p>
                <p className="text-lg font-bold text-amber-700">
                  {product.activeOrderCount || 0}
                  {(product.quantityInActiveOrders || 0) !== (product.activeOrderCount || 0) && (
                    <span className="text-xs font-normal text-amber-600 ml-0.5">({product.quantityInActiveOrders})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
              <BoxSelect size={18} className="text-purple-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Available</p>
                <p className={`text-lg font-bold ${product.availableQuantity <= 0 ? 'text-red-600' : product.availableQuantity < minStock ? 'text-amber-600' : 'text-gray-900'}`}>{product.availableQuantity}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
              <ShoppingBag size={18} className="text-terracotta-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Total Orders</p>
                <p className="text-lg font-bold text-gray-900">{product.totalOrders}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
              <TrendingUp size={18} className="text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(product.totalRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
              <RotateCcw size={18} className="text-red-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Return Rate</p>
                <p className="text-lg font-bold text-gray-900">{formatPercent(product.returnRate * 100)}</p>
              </div>
            </div>
          </div>

          {/* ─── Stock Management Section (full-width) ─── */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Boxes size={16} className="text-terracotta-600" /> Stock Management
              </h3>
              <button
                onClick={openStockModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 font-medium"
              >
                Manage Stock
              </button>
            </div>

            {/* Last activity */}
            {lastAudit ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <History size={12} className="shrink-0" />
                <span>
                  Last: <ChangeTypeBadge type={lastAudit.changeType} />
                  {' '}
                  <span className={`font-semibold ${lastAudit.delta > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {lastAudit.delta > 0 ? '+' : ''}{lastAudit.delta}
                  </span>
                  {' '}({lastAudit.previousQty} → {lastAudit.newQty})
                  {' · '}{formatDateTime(lastAudit.changedAt)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No stock changes recorded yet</p>
            )}

            {/* Alerts */}
            {(isLowStock || isOutOfStock) && (
              <button onClick={openStockModal}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs ${
                  isOutOfStock ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
                }`}>
                <AlertTriangle size={14} className="shrink-0" />
                <span className="flex-1 font-medium">
                  {isOutOfStock ? 'Out of stock' : 'Low stock'}
                  {' — '}{product.availableQuantity} unit{product.availableQuantity === 1 ? '' : 's'} available
                  {!isOutOfStock && <>, minimum is {minStock}</>}
                </span>
                <span className="font-medium opacity-70">Restock →</span>
              </button>
            )}
            {isAboveMax && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="font-medium">
                  Stock ({product.instockQuantity}) exceeds max target ({maxStock})
                </span>
              </div>
            )}
          </div>
        </>

      {/* ─── Orders Table ─── */}
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

    {/* ─── Toast ─── */}
    <Toast toast={toast} onClose={clearToast} />

    {/* ─── Edit Details Modal ─── */}
    {editing && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Pencil size={18} className="text-terracotta-600" /> Edit Product Details
            </h2>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Product Name</label>
                <input type="text" value={editForm.productName} onChange={e => setEditForm({ ...editForm, productName: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => (
                    <button key={c} type="button"
                      onClick={() => setEditForm(f => ({
                        ...f,
                        category: f.category.includes(c) ? f.category.filter(x => x !== c) : [...f.category, c],
                        subCategory: [],
                      }))}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                        editForm.category.includes(c)
                          ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sub Category</label>
                {(() => {
                  const availableSubs = editForm.category.length > 0
                    ? [...new Set(editForm.category.flatMap(c => categorySubCategories[c] || []))]
                    : [...new Set(Object.values(categorySubCategories).flat())];
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {availableSubs.length === 0
                        ? <p className="text-xs text-gray-400">Select a category first</p>
                        : availableSubs.map(s => (
                            <button key={s} type="button"
                              onClick={() => setEditForm(f => ({
                                ...f,
                                subCategory: f.subCategory.includes(s) ? f.subCategory.filter(x => x !== s) : [...f.subCategory, s],
                              }))}
                              className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                                editForm.subCategory.includes(s)
                                  ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700 font-medium'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}>{s}</button>
                          ))
                      }
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cost Price</label>
                <input type="number" min="0" step="0.01" value={editForm.productCost} onChange={e => setEditForm({ ...editForm, productCost: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Selling Price</label>
                <input type="number" min="0" step="0.01" value={editForm.sellingPrice} onChange={e => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
              </div>
              <div title="Warn when stock goes below this level">
                <label className="block text-xs text-gray-500 mb-1">Min Stock</label>
                <input type="number" min="0" value={editForm.minStock} onChange={e => setEditForm({ ...editForm, minStock: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
              </div>
              <div title="Target max stock. 0 = no cap">
                <label className="block text-xs text-gray-500 mb-1">Max Stock</label>
                <input type="number" min="0" value={editForm.maxStock} onChange={e => setEditForm({ ...editForm, maxStock: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Stock quantity is managed separately — use <strong>Manage Stock</strong> to add or remove units.
            </p>
            <ImageUpload images={editForm.imageUrls} onChange={(urls) => setEditForm({ ...editForm, imageUrls: urls })} />
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              <X size={14} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
              <Check size={14} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ─── Manage Stock Modal ─── */}
    {stockModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStockModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Boxes size={18} className="text-terracotta-600" /> Manage Stock
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Current: <span className="font-semibold text-gray-700">{product.instockQuantity}</span> in stock
                {' · '}<span className="font-semibold text-gray-700">{product.availableQuantity}</span> available
                {maxStock > 0 && <> · Max: <span className="font-semibold text-gray-700">{maxStock}</span></>}
              </p>
            </div>
            <button onClick={() => setStockModalOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'adjust', label: 'Adjust Stock', icon: Boxes },
              { key: 'audit', label: 'Audit Trail', icon: History },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setStockTab(t.key); setStockError(''); if (t.key === 'audit') loadAudit(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  stockTab === t.key
                    ? 'border-terracotta-600 text-terracotta-700 bg-terracotta-50/30'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-5">
            {stockError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{stockError}</p>
            )}

            {stockTab === 'adjust' && (
              <div className="space-y-4">
                {/* +/- toggle + quantity input */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Quantity</label>
                  <div className="flex items-stretch gap-0">
                    {/* +/- button group */}
                    <div className="flex rounded-l-lg border border-gray-300 border-r-0 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('+')}
                        className={`px-3.5 py-2 text-sm font-bold transition-colors ${
                          stockDirection === '+'
                            ? 'bg-green-600 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('-')}
                        className={`px-3.5 py-2 text-sm font-bold border-l border-gray-300 transition-colors ${
                          stockDirection === '-'
                            ? 'bg-red-600 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                    {/* Number input */}
                    <input
                      type="number"
                      min="1"
                      value={stockQty}
                      onChange={e => setStockQty(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Enter quantity"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 min-w-0"
                    />
                  </div>
                  {stockQty && (
                    <p className="text-xs text-gray-400 mt-1">
                      New stock: {product.instockQuantity} {stockDirection === '+' ? '+' : '−'} {stockQty} = <span className="font-semibold text-gray-600">{Math.max(0, product.instockQuantity + (stockDirection === '+' ? parseInt(stockQty) || 0 : -(parseInt(stockQty) || 0)))}</span>
                    </p>
                  )}
                </div>

                {/* Reason dropdown */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Reason</label>
                  <select
                    value={stockReason}
                    onChange={e => setStockReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                  >
                    {reasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Custom reason text for "Other" */}
                {stockReason === 'Other' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Specify reason</label>
                    <input
                      type="text"
                      value={stockCustomReason}
                      onChange={e => setStockCustomReason(e.target.value)}
                      placeholder="e.g. Damaged in transit"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                    />
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleStockSubmit}
                  disabled={stockSaving || !stockQty}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
                    stockDirection === '+' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {stockDirection === '+' ? <Plus size={14} /> : <Minus size={14} />}
                  {stockSaving ? 'Saving...' : stockDirection === '+' ? 'Add to stock' : 'Remove from stock'}
                </button>
              </div>
            )}

            {stockTab === 'audit' && (
              <div>
                {auditLoading ? (
                  <Loader />
                ) : auditEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No stock changes recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...auditEntries].reverse().map((e, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChangeTypeBadge type={e.changeType} />
                            <span className={`font-bold ${e.delta > 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {e.delta > 0 ? '+' : ''}{e.delta}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({e.previousQty} → {e.newQty})
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{formatDateTime(e.changedAt)}</span>
                        </div>
                        {e.reason && <p className="text-xs text-gray-600 mt-1">{e.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </DetailOverlay>
  );
}

function ChangeTypeBadge({ type }) {
  const colors = {
    restock: 'bg-green-100 text-green-800',
    adjust: 'bg-blue-100 text-blue-800',
    delivered: 'bg-purple-100 text-purple-800',
    'delivery-reversed': 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}
