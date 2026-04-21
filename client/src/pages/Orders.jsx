import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, Eye, Plus, X, SlidersHorizontal, MoreVertical, CheckCircle, FileText, Trash2, Lightbulb, ShoppingBag, AlertTriangle, Clock, Users, TrendingDown } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { useOrderInsights } from '../hooks/useOrderInsights';
import StatusSelect from '../components/StatusSelect';
import StatusBadge from '../components/StatusBadge';
import InsightSection from '../components/InsightSection';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_MODES } from '../utils/formatters';
import { fetchCustomers, fetchInventory, addOrder, addCustomer, addProduct } from '../services/api';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import BillModal from '../components/BillModal';
import SearchableDropdown from '../components/SearchableDropdown';

const BATCH_SIZE = 25;

/* ─── CardActionMenu (mobile ⋮ menu) ─── */
function CardActionMenu({ order, onStatusChange, onGenerateBill }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-48 py-1 max-h-72 overflow-y-auto">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/orders/${order.rowIndex}`); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
            <Eye size={14} /> View Details
          </button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGenerateBill(order); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
            <FileText size={14} /> Generate Bill
          </button>
          <div className="border-t border-gray-100 my-1" />
          <p className="px-3 py-1 text-xs text-gray-400 font-medium">Change Status</p>
          {ORDER_STATUSES.map(s => (
            <button key={s} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStatusChange(s); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${s === order.orderStatus ? 'text-terracotta-600 font-medium' : 'text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── AddOrderModal ─── */
function AddOrderModal({ onClose, onAdded, onGenerateBill }) {
  const navigate = useNavigate();
  const { categories, categorySubCategories } = useCategories();
  const [modalStep, setModalStep] = useState('form'); // 'form' | 'confirmation'
  const [createdOrder, setCreatedOrder] = useState(null);
  const [form, setForm] = useState({
    orderDate: new Date().toLocaleDateString('en-GB'), orderFrom: '', customerName: '', customerPhone: '',
    customerAddress: '', modeOfPayment: '', discount: 0,
  });
  const [productLines, setProductLines] = useState([{ productName: '', unitCost: 0, unitSellingPrice: 0, quantity: 1 }]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [addingNewProductIdx, setAddingNewProductIdx] = useState(-1);
  const [newCustomer, setNewCustomer] = useState({ customerName: '', customerPhone: '', customerAddress: '' });
  const [newProduct, setNewProduct] = useState({ productName: '', category: '', subCategory: '', productCost: '', sellingPrice: '', instockQuantity: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    fetchCustomers('', 'Active').then(setCustomers).catch(() => {});
    fetchInventory({ status: 'Active' }).then(setProducts).catch(() => {});
  }, []);

  const handleCustomerSelect = (c) => setForm(f => ({ ...f, customerName: c.customerName, customerPhone: c.customerPhone, customerAddress: c.customerAddress }));

  const handleProductSelectForLine = (idx, p) => {
    setProductLines(prev => prev.map((line, i) => i === idx ? { ...line, productName: p.productName, unitCost: p.productCost || 0, unitSellingPrice: p.sellingPrice || p.productCost || 0 } : line));
  };

  const addProductLine = () => setProductLines(prev => [...prev, { productName: '', unitCost: 0, unitSellingPrice: 0, quantity: 1 }]);
  const removeProductLine = (idx) => setProductLines(prev => prev.filter((_, i) => i !== idx));
  const updateProductLine = (idx, field, value) => setProductLines(prev => prev.map((line, i) => i === idx ? { ...line, [field]: value } : line));

  const totalCost = productLines.reduce((sum, l) => sum + (l.unitCost || 0) * (l.quantity || 1), 0);
  const subtotal = productLines.reduce((sum, l) => sum + (l.unitSellingPrice || 0) * (l.quantity || 1), 0);
  const discount = parseFloat(form.discount) || 0;
  const pricePaid = Math.max(0, subtotal - discount);

  const handleAddNewCustomer = async () => {
    if (!newCustomer.customerName || !newCustomer.customerPhone) { setError('Customer name and phone are required'); return; }
    setSavingCustomer(true);
    try {
      const created = await addCustomer(newCustomer);
      setCustomers(prev => [...prev, created]);
      setForm(f => ({ ...f, customerName: created.customerName, customerPhone: created.customerPhone, customerAddress: created.customerAddress }));
      setAddingNewCustomer(false); setNewCustomer({ customerName: '', customerPhone: '', customerAddress: '' }); setError('');
    } catch (err) { setError(err.message); } finally { setSavingCustomer(false); }
  };

  const handleAddNewProduct = async (lineIdx) => {
    if (!newProduct.productName || !newProduct.category || !newProduct.productCost) { setError('Product name, category, and cost are required'); return; }
    setSavingProduct(true);
    try {
      const created = await addProduct({ ...newProduct, sellingPrice: parseFloat(newProduct.sellingPrice) || 0, instockQuantity: parseInt(newProduct.instockQuantity) || 0 });
      setProducts(prev => [...prev, created]);
      handleProductSelectForLine(lineIdx, created);
      setAddingNewProductIdx(-1); setNewProduct({ productName: '', category: '', subCategory: '', productCost: '', sellingPrice: '', instockQuantity: '' }); setError('');
    } catch (err) { setError(err.message); } finally { setSavingProduct(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = productLines.filter(l => l.productName);
    if (!form.orderFrom || !form.customerName || !form.customerPhone || validLines.length === 0 || !form.modeOfPayment) {
      setError('Please fill in all required fields and add at least one product'); return;
    }
    setSaving(true); setError('');
    try {
      const result = await addOrder({
        ...form,
        productLines: validLines.map(l => ({ ...l, unitSellingPrice: l.unitSellingPrice || 0 })),
        pricePaid,
        discount,
      });
      setCreatedOrder(result);
      onAdded();
      setModalStep('confirmation');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500";

  if (modalStep === 'confirmation' && createdOrder) {
    const profit = (createdOrder.pricePaid || 0) - (createdOrder.productCost || 0);
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Order Created Successfully</h2>
            <p className="text-sm text-gray-500 mt-1">{createdOrder.orderNumber}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium text-gray-900">{createdOrder.customerName}</span></div>
            <div className="border-t border-gray-200 pt-2">
              <span className="text-gray-500 block mb-1">Products</span>
              {(createdOrder.productLines || []).map((line, i) => (
                <div key={i} className="flex justify-between text-gray-700">
                  <span>{line.productName} &times;{line.quantity}</span>
                  <span>{formatCurrency(line.lineTotal)}</span>
                </div>
              ))}
            </div>
            {createdOrder.discount > 0 && (
              <div className="border-t border-gray-200 pt-2 flex justify-between"><span className="text-gray-500">Discount</span><span className="font-medium text-red-600">-{formatCurrency(createdOrder.discount)}</span></div>
            )}
            <div className={`${createdOrder.discount > 0 ? '' : 'border-t border-gray-200 pt-2 '}flex justify-between`}><span className="text-gray-500">Price Paid</span><span className="font-semibold text-gray-900">{formatCurrency(createdOrder.pricePaid)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Profit</span><span className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</span></div>
            <div className="flex justify-between items-center"><span className="text-gray-500">Status</span><StatusBadge status="Pending" /></div>
          </div>
          <div className="flex flex-col gap-2 mt-5">
            <button onClick={() => navigate(`/orders/${createdOrder.rowIndex}`)}
              className="w-full px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 flex items-center justify-center gap-2">
              <Eye size={16} /> View Order Details
            </button>
            <button onClick={() => { onGenerateBill(createdOrder); onClose(); }}
              className="w-full px-4 py-2 text-sm border border-terracotta-300 text-terracotta-700 rounded-lg hover:bg-terracotta-50 flex items-center justify-center gap-2">
              <FileText size={16} /> Generate Bill
            </button>
            <button onClick={onClose} className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="text" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} className={inputClass} placeholder="DD/MM/YYYY" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
            <select value={form.orderFrom} onChange={e => setForm({ ...form, orderFrom: e.target.value })} className={inputClass}>
              <option value="">Select source</option>
              {ORDER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Customer */}
          {!addingNewCustomer ? (
            <SearchableDropdown label="Customer *" placeholder="Search by name or phone..." items={customers}
              displayFn={c => `${c.customerName} - ${c.customerPhone}`} onSelect={handleCustomerSelect}
              onAddNew={() => setAddingNewCustomer(true)} addNewLabel="Add new customer" />
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
          {form.customerName && !addingNewCustomer && <p className="text-xs text-gray-500 -mt-2">Selected: {form.customerName} ({form.customerPhone})</p>}

          {/* Product Lines */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Products *</label>
            <div className="space-y-3">
              {productLines.map((line, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Product {idx + 1}</span>
                    {productLines.length > 1 && (
                      <button type="button" onClick={() => removeProductLine(idx)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                  {addingNewProductIdx !== idx ? (
                    <>
                      <SearchableDropdown label="" placeholder="Search product..." items={products}
                        displayFn={p => `${p.productName} (${p.articleId})`}
                        onSelect={(p) => handleProductSelectForLine(idx, p)}
                        onAddNew={() => setAddingNewProductIdx(idx)} addNewLabel="Add new product" />
                      {line.productName && <p className="text-xs text-gray-500">Selected: {line.productName} (Cost: ₹{line.unitCost})</p>}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Qty</label>
                          <input type="number" min="1" value={line.quantity} onChange={e => updateProductLine(idx, 'quantity', parseInt(e.target.value) || 1)} className={inputClass} />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Selling Price</label>
                          <div className="w-full px-3 py-2 text-sm border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                            {line.productName ? formatCurrency(line.unitSellingPrice) : '—'}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="border border-terracotta-200 rounded-lg p-3 space-y-3 bg-terracotta-50/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-terracotta-700">New Product</span>
                        <button type="button" onClick={() => setAddingNewProductIdx(-1)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                      </div>
                      <input type="text" value={newProduct.productName} onChange={e => setNewProduct({ ...newProduct, productName: e.target.value })} className={inputClass} placeholder="Product name *" />
                      <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value, subCategory: '' })} className={inputClass}>
                        <option value="">Category *</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={newProduct.subCategory} onChange={e => setNewProduct({ ...newProduct, subCategory: e.target.value })} className={inputClass}>
                        <option value="">Sub Category</option>
                        {(categorySubCategories[newProduct.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" value={newProduct.productCost} onChange={e => setNewProduct({ ...newProduct, productCost: e.target.value })} className={inputClass} placeholder="Cost price *" />
                      <input type="number" value={newProduct.sellingPrice} onChange={e => setNewProduct({ ...newProduct, sellingPrice: e.target.value })} className={inputClass} placeholder="Selling price" />
                      <input type="number" value={newProduct.instockQuantity} onChange={e => setNewProduct({ ...newProduct, instockQuantity: e.target.value })} className={inputClass} placeholder="In-stock quantity" />
                      <button type="button" onClick={() => handleAddNewProduct(idx)} disabled={savingProduct}
                        className="w-full px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                        {savingProduct ? 'Creating...' : 'Create Product'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addProductLine}
              className="mt-2 flex items-center gap-1.5 text-sm text-terracotta-600 hover:text-terracotta-700 font-medium">
              <Plus size={14} /> Add Another Product
            </button>
            <div className="mt-2 text-xs text-gray-500 space-x-3">
              <span>Subtotal: <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span></span>
              {discount > 0 && <span>Discount: <span className="font-medium text-red-600">-{formatCurrency(discount)}</span></span>}
              <span>Total: <span className="font-semibold text-gray-900">{formatCurrency(pricePaid)}</span></span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
            <select value={form.modeOfPayment} onChange={e => setForm({ ...form, modeOfPayment: e.target.value })} className={inputClass}>
              <option value="">Select payment mode</option>
              {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
            <input type="number" min="0" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Paid (auto-calculated)</label>
            <input type="number" value={pricePaid} readOnly className={`${inputClass} bg-gray-50 cursor-not-allowed`} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Add Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Orders Page ─── */
export default function Orders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'insights';

  // Insights data — always fetched (it's the default tab)
  const { data: insightsData, loading: insightsLoading, error: insightsError } = useOrderInsights();

  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const { orders, loading, error, refresh, updateStatus } = useOrders(filters);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState('orderDate');
  const [sortDir, setSortDir] = useState('desc');
  const [billOrder, setBillOrder] = useState(null);

  // Filter flap state
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedSources, setAppliedSources] = useState([]);
  const [appliedStatuses, setAppliedStatuses] = useState([]);
  const [appliedPayments, setAppliedPayments] = useState([]);
  const [pendingSources, setPendingSources] = useState([]);
  const [pendingStatuses, setPendingStatuses] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);

  // Lazy loading
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);

  const totalApplied = appliedSources.length + appliedStatuses.length + appliedPayments.length;

  const openFilterFlap = () => {
    setPendingSources([...appliedSources]);
    setPendingStatuses([...appliedStatuses]);
    setPendingPayments([...appliedPayments]);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedSources([...pendingSources]);
    setAppliedStatuses([...pendingStatuses]);
    setAppliedPayments([...pendingPayments]);
    const newFilters = {};
    if (search) newFilters.search = search;
    if (pendingSources.length) newFilters.source = pendingSources;
    if (pendingStatuses.length) newFilters.status = pendingStatuses;
    if (pendingPayments.length) newFilters.payment = pendingPayments;
    setFilters(newFilters);
    setFilterOpen(false);
  };

  const clearAllFilters = () => {
    setPendingSources([]);
    setPendingStatuses([]);
    setPendingPayments([]);
  };

  const removeChip = (type, value) => {
    let ns = [...appliedSources], nt = [...appliedStatuses], np = [...appliedPayments];
    if (type === 'source') ns = ns.filter(s => s !== value);
    if (type === 'status') nt = nt.filter(s => s !== value);
    if (type === 'payment') np = np.filter(p => p !== value);
    setAppliedSources(ns); setAppliedStatuses(nt); setAppliedPayments(np);
    const newFilters = {};
    if (search) newFilters.search = search;
    if (ns.length) newFilters.source = ns;
    if (nt.length) newFilters.status = nt;
    if (np.length) newFilters.payment = np;
    setFilters(newFilters);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const newFilters = { ...filters };
    if (search) newFilters.search = search;
    else delete newFilters.search;
    setFilters(newFilters);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortedOrders = useMemo(() => {
    let list = [...orders];
    if (sortField) {
      list.sort((a, b) => {
        let aVal = a[sortField], bVal = b[sortField];
        if (sortField === 'orderDate') {
          const parse = s => { const [d,m,y] = (s||'').split('/'); return new Date(y, m-1, d) || new Date(0); };
          aVal = parse(aVal); bVal = parse(bVal);
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase();
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [orders, sortField, sortDir]);

  const visibleOrders = sortedOrders.slice(0, visibleCount);

  // Reset visible count on filter/sort changes
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [filters, sortField, sortDir]);

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(prev => Math.min(prev + BATCH_SIZE, sortedOrders.length));
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sortedOrders.length, visibleCount]);

  const togglePending = (setter, current, value) => {
    setter(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Orders</h1>
          <button onClick={refresh} className="p-2 text-terracotta-700 hover:bg-terracotta-50 rounded-lg transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
          <Plus size={16} />
          <span className="hidden md:inline">Add Order</span>
        </button>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'insights', label: 'Insights', icon: Lightbulb },
          { key: 'details', label: 'All Orders', icon: ShoppingBag },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-terracotta-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Insights Tab ─── */}
      {activeTab === 'insights' && (
        <div>
          {insightsLoading && <Loader />}
          {insightsError && <ErrorMessage message={insightsError} />}
          {insightsData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <InsightSection icon={AlertTriangle} title="COD Payment Follow-ups" count={insightsData.codFollowUps?.length || 0} color="amber">
                {!insightsData.codFollowUps?.length ? (
                  <p className="text-sm text-gray-500">No COD follow-ups needed</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.codFollowUps.map(o => (
                      <Link key={o.rowIndex} to={`/orders/${o.rowIndex}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{o.customerName}</p>
                          <p className="text-xs text-gray-500">{o.productOrdered} · {o.orderDate}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(o.pricePaid)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>

              <InsightSection icon={Clock} title="Delayed Orders" count={insightsData.delayedOrders?.length || 0} color="red">
                {!insightsData.delayedOrders?.length ? (
                  <p className="text-sm text-gray-500">No delayed orders</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.delayedOrders.map(o => (
                      <Link key={o.rowIndex} to={`/orders/${o.rowIndex}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{o.customerName}</p>
                          <p className="text-xs text-gray-500">{o.productOrdered} · {o.orderDate}</p>
                        </div>
                        <StatusBadge status={o.orderStatus} />
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>

              <InsightSection icon={Users} title="Repeat Customers" count={insightsData.repeatCustomers?.length || 0} color="blue">
                {!insightsData.repeatCustomers?.length ? (
                  <p className="text-sm text-gray-500">No repeat customers yet</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.repeatCustomers.map((c, i) => (
                      <Link key={i} to={`/customers/${encodeURIComponent(c.customerPhone)}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.customerName}</p>
                          <p className="text-xs text-gray-500">{c.customerPhone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{c.orderCount} orders</p>
                          <p className="text-xs text-gray-500">{formatCurrency(c.totalSpent)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>

              <InsightSection icon={TrendingDown} title="Low Margin Orders" count={insightsData.lowMarginOrders?.length || 0} color="orange">
                {!insightsData.lowMarginOrders?.length ? (
                  <p className="text-sm text-gray-500">No low-margin orders</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {insightsData.lowMarginOrders.map(o => (
                      <Link key={o.rowIndex} to={`/orders/${o.rowIndex}`} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{o.productOrdered}</p>
                          <p className="text-xs text-gray-500">{o.customerName} · {o.orderDate}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{formatCurrency(o.profit)}</p>
                          <p className="text-xs text-gray-500">Cost: {formatCurrency(o.productCost)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </InsightSection>
            </div>
          )}
        </div>
      )}

      {/* ─── All Orders Tab ─── */}
      {activeTab === 'details' && <>
      {/* ─── Search + Filter Button ─── */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 md:flex-none md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search name, phone, product..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" />
        </form>
        <button onClick={openFilterFlap}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors ml-auto shrink-0">
          <SlidersHorizontal size={16} />
          <span className="hidden md:inline">Filters</span>
          {totalApplied > 0 && (
            <span className="bg-terracotta-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{totalApplied}</span>
          )}
        </button>
      </div>

      {/* ─── Filter Chips ─── */}
      {totalApplied > 0 && (
        <div className="flex flex-wrap gap-2">
          {appliedSources.map(s => (
            <span key={`src-${s}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-terracotta-50 text-terracotta-700 text-xs rounded-full font-medium">
              {s} <button onClick={() => removeChip('source', s)} className="hover:text-terracotta-900"><X size={12} /></button>
            </span>
          ))}
          {appliedStatuses.map(s => (
            <span key={`st-${s}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
              {s} <button onClick={() => removeChip('status', s)} className="hover:text-blue-900"><X size={12} /></button>
            </span>
          ))}
          {appliedPayments.map(p => (
            <span key={`pm-${p}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
              {p} <button onClick={() => removeChip('payment', p)} className="hover:text-green-900"><X size={12} /></button>
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
                      { key: 'orderDate', label: 'Date' }, { key: 'orderFrom', label: 'Source' },
                      { key: 'customerName', label: 'Customer' }, { key: 'productOrdered', label: 'Product' },
                      { key: 'quantityOrdered', label: 'Qty' }, { key: 'modeOfPayment', label: 'Payment' },
                      { key: 'pricePaid', label: 'Price' }, { key: 'discount', label: 'Discount' }, { key: 'profit', label: 'Profit' },
                      { key: 'paymentStatus', label: 'Paid?' }, { key: 'orderStatus', label: 'Status' }, { key: null, label: 'Actions' },
                    ].map(col => (
                      <th key={col.label} onClick={() => col.key && handleSort(col.key)}
                        className={`px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-gray-900' : ''}`}>
                        {col.label}{sortField === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleOrders.map(order => (
                    <tr key={order.rowIndex} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">{order.orderFrom}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {order.customerPhone ? (
                          <Link to={`/customers/${encodeURIComponent(order.customerPhone)}`} className="hover:text-terracotta-600 transition-colors">{order.customerName}</Link>
                        ) : order.customerName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {(() => {
                          const fl = order.productLines?.[0];
                          const name = fl?.productName || order.productOrdered;
                          const aid = fl?.articleId || order.articleId;
                          return aid ? (
                            <Link to={`/inventory/${encodeURIComponent(aid)}`} className="hover:text-terracotta-600 transition-colors">{name}</Link>
                          ) : name;
                        })()}
                        {order.productLines?.length > 1 && <span className="ml-1 text-xs text-terracotta-600 font-medium">(+{order.productLines.length - 1} more)</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{order.quantityOrdered}</td>
                      <td className="px-4 py-3 text-gray-600">{order.modeOfPayment}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                      <td className="px-4 py-3 text-gray-600">{order.discount > 0 ? formatCurrency(order.discount) : '-'}</td>
                      <td className={`px-4 py-3 font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(order.profit)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const s = order.paymentStatus || 'Fully Paid';
                          const styles = { 'Fully Paid': 'bg-green-50 text-green-700 border-green-200', 'Partial Paid': 'bg-amber-50 text-amber-700 border-amber-200', 'Unpaid': 'bg-red-50 text-red-600 border-red-200' };
                          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${styles[s] || styles['Unpaid']}`}>{s}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3"><StatusSelect currentStatus={order.orderStatus} onUpdate={(s) => updateStatus(order.rowIndex, s)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link to={`/orders/${order.rowIndex}`} className="text-terracotta-600 hover:text-terracotta-800"><Eye size={16} /></Link>
                          <button onClick={() => setBillOrder(order)} className="text-gray-400 hover:text-terracotta-600" title="Generate Bill"><FileText size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleOrders.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-500">No orders found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Mobile Cards ─── */}
          <div className="md:hidden space-y-3">
            {visibleOrders.map(order => (
              <div key={order.rowIndex} className="relative">
                <Link to={`/orders/${order.rowIndex}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow active:bg-gray-50">
                  {/* Top: Date + Source */}
                  <div className="flex items-center justify-between mb-2 pr-8">
                    <span className="text-xs text-gray-500">{order.orderDate}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">{order.orderFrom}</span>
                  </div>
                  {/* Customer + Product */}
                  <p className="font-medium text-gray-900 text-sm">{order.customerName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.productLines?.[0]?.productName || order.productOrdered} &times;{order.productLines?.[0]?.quantity || order.quantityOrdered}
                    {order.productLines?.length > 1 && <span className="text-terracotta-600 font-medium"> (+{order.productLines.length - 1} more)</span>}
                  </p>
                  {/* Bottom: Price + Profit + Status */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(order.pricePaid)}</span>
                      <span className={`text-xs font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(order.profit)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const s = order.paymentStatus || 'Fully Paid';
                        const styles = { 'Fully Paid': 'bg-green-50 text-green-700 border-green-200', 'Partial Paid': 'bg-amber-50 text-amber-700 border-amber-200', 'Unpaid': 'bg-red-50 text-red-600 border-red-200' };
                        return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[s] || styles['Unpaid']}`}>{s}</span>;
                      })()}
                      <StatusBadge status={order.orderStatus} />
                    </div>
                  </div>
                </Link>
                {/* ⋮ Action menu */}
                <div className="absolute top-3 right-3">
                  <CardActionMenu order={order} onStatusChange={(s) => updateStatus(order.rowIndex, s)} onGenerateBill={setBillOrder} />
                </div>
              </div>
            ))}
            {visibleOrders.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No orders found</div>
            )}
          </div>

          {/* ─── Lazy load sentinel + count ─── */}
          {visibleCount < sortedOrders.length && (
            <div ref={sentinelRef} className="py-4 text-center text-sm text-gray-400">Loading more...</div>
          )}
          <div className="text-center text-sm text-gray-500 py-1">
            Showing {visibleOrders.length} of {sortedOrders.length} order{sortedOrders.length !== 1 ? 's' : ''}
          </div>
        </>
      )}

      {/* ─── Filter Flap ─── */}
      {filterOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setFilterOpen(false)} />
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-xl border-b border-gray-200 animate-slide-down">
            <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              {/* Source */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Source</h3>
                <div className="flex flex-wrap gap-2">
                  {ORDER_SOURCES.map(s => (
                    <button key={s} type="button" onClick={() => togglePending(setPendingSources, pendingSources, s)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingSources.includes(s) ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map(s => (
                    <button key={s} type="button" onClick={() => togglePending(setPendingStatuses, pendingStatuses, s)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingStatuses.includes(s) ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Mode</h3>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_MODES.map(p => (
                    <button key={p} type="button" onClick={() => togglePending(setPendingPayments, pendingPayments, p)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingPayments.includes(p) ? 'bg-green-50 border-green-300 text-green-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>{p}</button>
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

      </>} {/* end All Orders tab */}

      {showAddModal && <AddOrderModal onClose={() => setShowAddModal(false)} onAdded={refresh} onGenerateBill={setBillOrder} />}
      {billOrder && <BillModal order={billOrder} onClose={() => setBillOrder(null)} />}
    </div>
  );
}
