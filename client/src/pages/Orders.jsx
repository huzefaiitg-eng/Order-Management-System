import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Eye, Plus, X, ChevronDown } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import StatusSelect from '../components/StatusSelect';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_MODES, PRODUCT_CATEGORIES } from '../utils/formatters';
import { fetchCustomers, fetchInventory, addOrder, addCustomer, addProduct } from '../services/api';

const SUB_CATEGORIES = ['Casual Wear', 'Office Wear', 'Party Wear', 'Sports', 'Ethnic', 'Daily Wear'];

function SearchableDropdown({ label, placeholder, items, displayFn, onSelect, onAddNew, addNewLabel }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = items.filter(item => displayFn(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 pr-8"
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button key={i} type="button" onClick={() => { onSelect(item); setSearch(displayFn(item)); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-terracotta-50 transition-colors">
              {displayFn(item)}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No results</p>}
          {onAddNew && (
            <button type="button" onClick={() => { onAddNew(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-terracotta-600 font-medium hover:bg-terracotta-50 border-t border-gray-100">
              + {addNewLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddOrderModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    orderDate: new Date().toLocaleDateString('en-GB'),
    orderFrom: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    productOrdered: '',
    productCost: '',
    modeOfPayment: '',
    quantityOrdered: 1,
    pricePaid: '',
  });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [addingNewProduct, setAddingNewProduct] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ customerName: '', customerPhone: '', customerAddress: '' });
  const [newProduct, setNewProduct] = useState({ productName: '', category: '', subCategory: '', productCost: '', instockQuantity: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    fetchCustomers('', 'Active').then(setCustomers).catch(() => {});
    fetchInventory({ status: 'Active' }).then(setProducts).catch(() => {});
  }, []);

  const handleCustomerSelect = (c) => {
    setForm(f => ({ ...f, customerName: c.customerName, customerPhone: c.customerPhone, customerAddress: c.customerAddress }));
  };

  const handleProductSelect = (p) => {
    setForm(f => ({ ...f, productOrdered: p.productName, productCost: p.productCost }));
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.customerName || !newCustomer.customerPhone) { setError('Customer name and phone are required'); return; }
    setSavingCustomer(true);
    try {
      const created = await addCustomer(newCustomer);
      setCustomers(prev => [...prev, created]);
      setForm(f => ({ ...f, customerName: created.customerName, customerPhone: created.customerPhone, customerAddress: created.customerAddress }));
      setAddingNewCustomer(false);
      setNewCustomer({ customerName: '', customerPhone: '', customerAddress: '' });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleAddNewProduct = async () => {
    if (!newProduct.productName || !newProduct.category || !newProduct.productCost) { setError('Product name, category, and cost are required'); return; }
    setSavingProduct(true);
    try {
      const created = await addProduct({ ...newProduct, instockQuantity: parseInt(newProduct.instockQuantity) || 0 });
      setProducts(prev => [...prev, created]);
      setForm(f => ({ ...f, productOrdered: created.productName, productCost: created.productCost }));
      setAddingNewProduct(false);
      setNewProduct({ productName: '', category: '', subCategory: '', productCost: '', instockQuantity: '' });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.orderFrom || !form.customerName || !form.customerPhone || !form.productOrdered || !form.modeOfPayment) {
      setError('Please fill in all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addOrder(form);
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="text" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })}
              className={inputClass} placeholder="DD/MM/YYYY" />
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
            <select value={form.orderFrom} onChange={e => setForm({ ...form, orderFrom: e.target.value })}
              className={inputClass}>
              <option value="">Select source</option>
              {ORDER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Customer */}
          {!addingNewCustomer ? (
            <SearchableDropdown
              label="Customer *"
              placeholder="Search by name or phone..."
              items={customers}
              displayFn={c => `${c.customerName} - ${c.customerPhone}`}
              onSelect={handleCustomerSelect}
              onAddNew={() => setAddingNewCustomer(true)}
              addNewLabel="Add new customer"
            />
          ) : (
            <div className="border border-terracotta-200 rounded-lg p-3 space-y-3 bg-terracotta-50/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-terracotta-700">New Customer</span>
                <button type="button" onClick={() => setAddingNewCustomer(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <input type="text" value={newCustomer.customerName} onChange={e => setNewCustomer({ ...newCustomer, customerName: e.target.value })}
                className={inputClass} placeholder="Name *" />
              <input type="text" value={newCustomer.customerPhone} onChange={e => setNewCustomer({ ...newCustomer, customerPhone: e.target.value })}
                className={inputClass} placeholder="Phone *" />
              <input type="text" value={newCustomer.customerAddress} onChange={e => setNewCustomer({ ...newCustomer, customerAddress: e.target.value })}
                className={inputClass} placeholder="Address" />
              <button type="button" onClick={handleAddNewCustomer} disabled={savingCustomer}
                className="w-full px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                {savingCustomer ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          )}
          {form.customerName && !addingNewCustomer && (
            <p className="text-xs text-gray-500 -mt-2">Selected: {form.customerName} ({form.customerPhone})</p>
          )}

          {/* Product */}
          {!addingNewProduct ? (
            <SearchableDropdown
              label="Product *"
              placeholder="Search by name or article ID..."
              items={products}
              displayFn={p => `${p.productName} (${p.articleId})`}
              onSelect={handleProductSelect}
              onAddNew={() => setAddingNewProduct(true)}
              addNewLabel="Add new product"
            />
          ) : (
            <div className="border border-terracotta-200 rounded-lg p-3 space-y-3 bg-terracotta-50/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-terracotta-700">New Product</span>
                <button type="button" onClick={() => setAddingNewProduct(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <input type="text" value={newProduct.productName} onChange={e => setNewProduct({ ...newProduct, productName: e.target.value })}
                className={inputClass} placeholder="Product name *" />
              <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} className={inputClass}>
                <option value="">Category *</option>
                {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={newProduct.subCategory} onChange={e => setNewProduct({ ...newProduct, subCategory: e.target.value })} className={inputClass}>
                <option value="">Sub Category</option>
                {SUB_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="number" value={newProduct.productCost} onChange={e => setNewProduct({ ...newProduct, productCost: e.target.value })}
                className={inputClass} placeholder="Cost price *" />
              <input type="number" value={newProduct.instockQuantity} onChange={e => setNewProduct({ ...newProduct, instockQuantity: e.target.value })}
                className={inputClass} placeholder="In-stock quantity" />
              <button type="button" onClick={handleAddNewProduct} disabled={savingProduct}
                className="w-full px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                {savingProduct ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          )}
          {form.productOrdered && !addingNewProduct && (
            <p className="text-xs text-gray-500 -mt-2">Selected: {form.productOrdered} (Cost: ₹{form.productCost})</p>
          )}

          {/* Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
            <select value={form.modeOfPayment} onChange={e => setForm({ ...form, modeOfPayment: e.target.value })}
              className={inputClass}>
              <option value="">Select payment mode</option>
              {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input type="number" min="1" value={form.quantityOrdered} onChange={e => setForm({ ...form, quantityOrdered: parseInt(e.target.value) || 1 })}
              className={inputClass} />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Paid</label>
            <input type="number" value={form.pricePaid} onChange={e => setForm({ ...form, pricePaid: e.target.value })}
              className={inputClass} placeholder="Amount paid by customer" />
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

export default function Orders() {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const { orders, loading, error, refresh, updateStatus } = useOrders(filters);
  const [showAddModal, setShowAddModal] = useState(false);

  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  let sortedOrders = [...orders];
  if (sortField) {
    sortedOrders.sort((a, b) => {
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
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
            <Plus size={16} />
            Add Order
          </button>
          <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 w-64"
          />
        </form>

        <select onChange={e => handleFilterChange('source', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="">All Sources</option>
          {ORDER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select onChange={e => handleFilterChange('status', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select onChange={e => handleFilterChange('payment', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="">All Payments</option>
          {PAYMENT_MODES.map(p => <option key={p} value={p}>{p}</option>)}
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
                    { key: 'orderDate', label: 'Date' },
                    { key: 'orderFrom', label: 'Source' },
                    { key: 'customerName', label: 'Customer' },
                    { key: 'productOrdered', label: 'Product' },
                    { key: 'modeOfPayment', label: 'Payment' },
                    { key: 'pricePaid', label: 'Price' },
                    { key: 'profit', label: 'Profit' },
                    { key: 'orderStatus', label: 'Status' },
                    { key: null, label: 'Actions' },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={() => col.key && handleSort(col.key)}
                      className={`px-4 py-3 text-left font-medium text-gray-600 ${col.key ? 'cursor-pointer hover:text-gray-900' : ''}`}
                    >
                      {col.label}
                      {sortField === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedOrders.map(order => (
                  <tr key={order.rowIndex} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                        {order.orderFrom}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.customerName}</td>
                    <td className="px-4 py-3 text-gray-600">{order.productOrdered}</td>
                    <td className="px-4 py-3 text-gray-600">{order.modeOfPayment}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(order.pricePaid)}</td>
                    <td className={`px-4 py-3 font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(order.profit)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        currentStatus={order.orderStatus}
                        onUpdate={(newStatus) => updateStatus(order.rowIndex, newStatus)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/orders/${order.rowIndex}`}
                        className="text-terracotta-600 hover:text-terracotta-800"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {sortedOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No orders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            {sortedOrders.length} order{sortedOrders.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {showAddModal && <AddOrderModal onClose={() => setShowAddModal(false)} onAdded={refresh} />}
    </div>
  );
}
