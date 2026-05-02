import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Plus, X, CheckCircle, FileText, Eye, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  addOrder, fetchCustomers, fetchInventory, addCustomer, addProduct,
} from '../services/api';
import DetailOverlay from '../components/DetailOverlay';
import ProductLineEditor from '../components/ProductLineEditor';
import CustomerSelector from '../components/CustomerSelector';
import NumberField from '../components/NumberField';
import StatusBadge from '../components/StatusBadge';
import BillModal from '../components/BillModal';
import { useCategories } from '../hooks/useCategories';
import {
  formatCurrency, ORDER_SOURCES, PAYMENT_MODES,
} from '../utils/formatters';

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500';

function emptyLine() {
  return { productName: '', productCost: 0, sellingPrice: 0, quantity: 1, articleId: '' };
}

export default function AddOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const hasInventoryAccess = !!user?.hasInventoryAccess;
  const { categories } = useCategories();

  const prefill = location.state?.prefill || null;

  const [step, setStep] = useState('form'); // 'form' | 'confirmation'
  const [createdOrder, setCreatedOrder] = useState(null);
  const [billOrder, setBillOrder] = useState(null);

  const [form, setForm] = useState({
    orderDate: new Date().toLocaleDateString('en-GB'),
    orderFrom: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerEmail: '',
    modeOfPayment: '',
    discount: 0,
  });

  // Product lines start in inventory mode if user has access, otherwise custom
  const [lines, setLines] = useState(() => {
    const first = emptyLine();
    if (!hasInventoryAccess) first._mode = 'custom';
    return [first];
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ customerName: '', customerPhone: '', customerAddress: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const prefillApplied = useRef({ customer: false, products: false });

  // Load master data
  useEffect(() => {
    fetchCustomers('', 'Active').then(setCustomers).catch(() => {});
    if (hasInventoryAccess) {
      fetchInventory({ status: 'Active' }).then(setProducts).catch(() => {});
    }
  }, [hasInventoryAccess]);

  const handleCustomerSelect = (c) =>
    setForm(f => ({
      ...f,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      customerAddress: c.customerAddress || '',
      customerEmail: c.customerEmail || '',
    }));

  // Apply prefill customer once customers list has loaded
  useEffect(() => {
    if (!prefill || prefillApplied.current.customer) return;
    if (!customers.length && prefill.customerPhone) {
      // Customers haven't loaded yet — wait
      return;
    }
    prefillApplied.current.customer = true;
    const match = prefill.customerPhone
      ? customers.find(c => c.customerPhone === prefill.customerPhone)
      : null;
    if (match) {
      handleCustomerSelect(match);
    } else {
      setForm(f => ({
        ...f,
        customerName: prefill.customerName || '',
        customerPhone: prefill.customerPhone || '',
        customerAddress: prefill.customerAddress || '',
        customerEmail: prefill.customerEmail || '',
      }));
    }
  }, [prefill, customers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply prefill productLines
  useEffect(() => {
    if (!prefill || prefillApplied.current.products) return;
    if (!Array.isArray(prefill.productLines) || prefill.productLines.length === 0) {
      prefillApplied.current.products = true;
      return;
    }
    // Wait for inventory if user has access (so we can re-link articleIds)
    if (hasInventoryAccess && !products.length) return;
    prefillApplied.current.products = true;

    const seeded = prefill.productLines.map(line => {
      const articleId = line.articleId || '';
      const productName = line.productName || '';
      const productCost = Number(line.productCost) || 0;
      const sellingPrice = Number(line.sellingPrice) || 0;
      const quantity = Math.max(1, Math.round(Number(line.quantity) || 1));

      // Verify articleId still exists in inventory; otherwise treat as custom.
      const inventoryMatch = articleId
        ? products.find(p => p.articleId === articleId)
        : null;

      if (inventoryMatch && hasInventoryAccess) {
        return {
          articleId: inventoryMatch.articleId,
          productName: inventoryMatch.productName,
          productCost: Number(inventoryMatch.productCost) || productCost,
          sellingPrice: Number(inventoryMatch.sellingPrice) || sellingPrice,
          quantity,
          _mode: 'inventory',
        };
      }
      // Custom or stale-articleId line
      return { articleId: '', productName, productCost, sellingPrice, quantity, _mode: 'custom' };
    });
    setLines(seeded.length > 0 ? seeded : [emptyLine()]);
  }, [prefill, products, hasInventoryAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totals
  const totalCost = lines.reduce((s, l) => s + (Number(l.productCost) || 0) * (Number(l.quantity) || 1), 0);
  const subtotal  = lines.reduce((s, l) => s + (Number(l.sellingPrice) || 0) * (Number(l.quantity) || 1), 0);
  const discount  = parseFloat(form.discount) || 0;
  const pricePaid = Math.max(0, subtotal - discount);
  const profit    = pricePaid - totalCost;

  const handleAddNewCustomer = async () => {
    if (!newCustomer.customerName || !newCustomer.customerPhone) {
      setError('Customer name and phone are required'); return;
    }
    setSavingCustomer(true);
    try {
      const created = await addCustomer(newCustomer);
      setCustomers(prev => [...prev, created]);
      setForm(f => ({ ...f, customerName: created.customerName, customerPhone: created.customerPhone, customerAddress: created.customerAddress || '' }));
      setAddingNewCustomer(false);
      setNewCustomer({ customerName: '', customerPhone: '', customerAddress: '' });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = lines.filter(l => l.productName && (l.quantity || 0) > 0);
    if (!form.orderFrom || !form.customerName || !form.customerPhone || validLines.length === 0 || !form.modeOfPayment) {
      setError('Please fill in all required fields and add at least one product');
      return;
    }
    setSaving(true); setError('');
    try {
      const result = await addOrder({
        orderDate: form.orderDate,
        orderFrom: form.orderFrom,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerAddress: form.customerAddress,
        modeOfPayment: form.modeOfPayment,
        productLines: validLines.map(l => ({
          productName: l.productName,
          unitCost: Number(l.productCost) || 0,
          unitSellingPrice: Number(l.sellingPrice) || 0,
          quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
          articleId: l.articleId || '',
        })),
        pricePaid,
        discount,
      });
      setCreatedOrder(result);
      setStep('confirmation');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Confirmation step ─────────────────────────────────────────
  if (step === 'confirmation' && createdOrder) {
    const confirmedProfit = (createdOrder.pricePaid || 0) - (createdOrder.productCost || 0);
    return (
      <DetailOverlay fallback="/orders?tab=details" title="Order Created">
        <div className="p-6 max-w-xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Order created successfully</h2>
            <p className="text-sm text-gray-500 mt-1">{createdOrder.orderNumber}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-5 py-3 flex justify-between text-sm">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-900">{createdOrder.customerName}</span>
            </div>
            <div className="px-5 py-3 text-sm">
              <span className="text-gray-500 block mb-2">Products</span>
              {(createdOrder.productLines || []).map((line, i) => (
                <div key={i} className="flex justify-between text-gray-700 py-0.5">
                  <span>{line.productName} ×{line.quantity}{!line.articleId && <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-600">custom</span>}</span>
                  <span>{formatCurrency(line.lineTotal)}</span>
                </div>
              ))}
            </div>
            {createdOrder.discount > 0 && (
              <div className="px-5 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="font-medium text-red-600">-{formatCurrency(createdOrder.discount)}</span>
              </div>
            )}
            <div className="px-5 py-3 flex justify-between text-sm">
              <span className="text-gray-500">Price Paid</span>
              <span className="font-semibold text-gray-900">{formatCurrency(createdOrder.pricePaid)}</span>
            </div>
            <div className="px-5 py-3 flex justify-between text-sm">
              <span className="text-gray-500">Profit</span>
              <span className={`font-semibold ${confirmedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(confirmedProfit)}
              </span>
            </div>
            <div className="px-5 py-3 flex justify-between items-center text-sm">
              <span className="text-gray-500">Status</span>
              <StatusBadge status="Pending" />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => navigate(`/orders/${createdOrder.rowIndex}`)}
              className="w-full px-4 py-2.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 flex items-center justify-center gap-2 font-medium"
            >
              <Eye size={16} /> View Order Details
            </button>
            <button
              onClick={() => setBillOrder(createdOrder)}
              className="w-full px-4 py-2.5 text-sm border border-terracotta-300 text-terracotta-700 rounded-lg hover:bg-terracotta-50 flex items-center justify-center gap-2 font-medium"
            >
              <FileText size={16} /> Generate Bill
            </button>
            <button
              onClick={() => navigate('/orders?tab=details')}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Orders
            </button>
          </div>
        </div>
        {billOrder && <BillModal order={billOrder} onClose={() => setBillOrder(null)} />}
      </DetailOverlay>
    );
  }

  // ─── Form step ─────────────────────────────────────────────────
  return (
    <DetailOverlay fallback="/orders?tab=details" title="Add Order">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Order Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag size={16} className="text-terracotta-600" />
              <h2 className="text-sm font-semibold text-gray-900">Order Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="text"
                  value={form.orderDate}
                  onChange={e => setForm({ ...form, orderDate: e.target.value })}
                  className={inputClass}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Source *</label>
                <select
                  value={form.orderFrom}
                  onChange={e => setForm({ ...form, orderFrom: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select source</option>
                  {ORDER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Mode *</label>
                <select
                  value={form.modeOfPayment}
                  onChange={e => setForm({ ...form, modeOfPayment: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select mode</option>
                  {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Customer</h2>
            {!addingNewCustomer ? (
              <CustomerSelector
                customers={customers}
                selected={form.customerName ? {
                  customerName:    form.customerName,
                  customerPhone:   form.customerPhone,
                  customerEmail:   form.customerEmail,
                  customerAddress: form.customerAddress,
                } : null}
                onSelect={handleCustomerSelect}
                onClear={() => setForm(f => ({ ...f, customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' }))}
                onAddNew={() => setAddingNewCustomer(true)}
              />
            ) : (
              <div className="border border-terracotta-200 rounded-lg p-3 space-y-3 bg-terracotta-50/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-terracotta-700">New Customer</span>
                  <button type="button" onClick={() => setAddingNewCustomer(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <input type="text" value={newCustomer.customerName} onChange={e => setNewCustomer({ ...newCustomer, customerName: e.target.value })} className={inputClass} placeholder="Name *" />
                <input type="text" value={newCustomer.customerPhone} onChange={e => setNewCustomer({ ...newCustomer, customerPhone: e.target.value })} className={inputClass} placeholder="Phone *" />
                <input type="text" value={newCustomer.customerAddress} onChange={e => setNewCustomer({ ...newCustomer, customerAddress: e.target.value })} className={inputClass} placeholder="Address" />
                <button type="button" onClick={handleAddNewCustomer} disabled={savingCustomer}
                  className="w-full px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                  {savingCustomer ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            )}
          </div>

          {/* Products */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Products</h2>
              {!hasInventoryAccess && (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full">
                  Custom items only
                </span>
              )}
            </div>
            <ProductLineEditor
              lines={lines}
              onChange={setLines}
              inventory={products}
              hasInventoryAccess={hasInventoryAccess}
              sellingPriceLocked={false}
            />
          </div>

          {/* Discount */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Tag size={16} className="text-terracotta-600" />
              <h2 className="text-sm font-semibold text-gray-900">Discount</h2>
              <span className="text-[11px] text-gray-400 font-normal">(optional, applied at order level)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <NumberField
                label="Discount amount (₹)"
                value={form.discount}
                onChange={(v) => setForm({ ...form, discount: v })}
                placeholder="0"
              />
              <div className="flex items-end text-xs text-gray-500">
                {discount > 0 && subtotal > 0
                  ? <span>That&apos;s a {((discount / subtotal) * 100).toFixed(1)}% discount on a subtotal of {formatCurrency(subtotal)}.</span>
                  : <span>Leave blank if no discount applies.</span>}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span className="font-medium text-red-600">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-700 font-medium">Price Paid</span>
              <span className="font-semibold text-gray-900">{formatCurrency(pricePaid)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Estimated profit</span>
              <span className={`${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50 font-medium flex items-center gap-2"
            >
              {saving ? 'Creating...' : <><Plus size={16} /> Create Order</>}
            </button>
          </div>
        </form>
      </div>
    </DetailOverlay>
  );
}
