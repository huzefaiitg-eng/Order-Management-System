import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Phone, MapPin, Package, CreditCard, Clock, FileText, Wallet, Trash2 } from 'lucide-react';
import { fetchOrders, updateOrderStatus, updatePaymentStatus, fetchOrderAudit, deleteOrder } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import StatusSelect from '../components/StatusSelect';
import DetailOverlay from '../components/DetailOverlay';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency, ORDER_STATUSES, STATUS_COLORS } from '../utils/formatters';
import BillModal from '../components/BillModal';

const STATUS_FLOW = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
const PAYMENT_STATUSES = ['Unpaid', 'Partial Paid', 'Fully Paid'];

function PaymentStatusBadge({ status }) {
  const styles = {
    'Fully Paid':   'bg-green-50 text-green-700 border-green-200',
    'Partial Paid': 'bg-amber-50 text-amber-700 border-amber-200',
    'Unpaid':       'bg-red-50 text-red-600 border-red-200',
  };
  const label = status || 'Unpaid';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[label] || styles['Unpaid']}`}>
      {label}
    </span>
  );
}

export default function OrderDetail() {
  const { rowIndex } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBill, setShowBill] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ status: 'Unpaid', amount: '' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentToast, setPaymentToast] = useState(null);

  const loadData = async () => {
    try {
      const [allOrders, audit] = await Promise.all([
        fetchOrders(),
        fetchOrderAudit(parseInt(rowIndex)).catch(() => []),
      ]);
      const current = allOrders.find(o => o.rowIndex === parseInt(rowIndex));
      if (!current) throw new Error('Order not found');
      setOrder(current);
      setAuditHistory(audit);

      const related = allOrders.filter(
        o => o.rowIndex !== current.rowIndex &&
          (o.customerPhone === current.customerPhone || o.customerName === current.customerName)
      );
      setCustomerOrders(related);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rowIndex]);

  const openPaymentEditor = () => {
    setPaymentForm({
      status: order.paymentStatus || 'Fully Paid',
      amount: order.paidAmount > 0 ? String(order.paidAmount) : '',
    });
    setEditingPayment(true);
    setPaymentToast(null);
  };

  const handlePaymentSave = async () => {
    setSavingPayment(true);
    try {
      const paidAmount = paymentForm.status === 'Fully Paid' ? order.pricePaid
        : paymentForm.status === 'Unpaid' ? 0
        : parseFloat(paymentForm.amount) || 0;
      await updatePaymentStatus(order.rowIndex, { paymentStatus: paymentForm.status, paidAmount });
      setOrder(prev => ({ ...prev, paymentStatus: paymentForm.status, paidAmount }));
      setEditingPayment(false);
      setPaymentToast({ type: 'success', msg: 'Payment status updated' });
      setTimeout(() => setPaymentToast(null), 3000);
    } catch (err) {
      setPaymentToast({ type: 'error', msg: err.message || 'Failed to update' });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDelete = () => {
    if (!order) return;
    const label = `${order.customerName} — ${order.productLines?.[0]?.productName || order.productOrdered} (${order.orderDate})`;
    setConfirmModal({
      title: 'Delete Order',
      message: `Delete "${label}"? This permanently removes the row from the sheet and cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await deleteOrder(order.rowIndex);
        navigate('/orders');
      },
    });
  };

  const handleStatusUpdate = async (newStatus) => {
    await updateOrderStatus(order.rowIndex, newStatus);
    setOrder(prev => ({ ...prev, orderStatus: newStatus }));
    // Refresh audit history after status change
    fetchOrderAudit(parseInt(rowIndex)).then(setAuditHistory).catch(() => {});
  };

  if (loading) return <DetailOverlay fallback="/orders"><Loader /></DetailOverlay>;
  if (error) return <DetailOverlay fallback="/orders"><ErrorMessage message={error} /></DetailOverlay>;
  if (!order) return null;

  const currentStatusIndex = STATUS_FLOW.indexOf(order.orderStatus);

  const productLines = order.productLines?.length > 0
    ? order.productLines
    : [{ productName: order.productOrdered, articleId: order.articleId, category: order.category, quantity: order.quantityOrdered, unitCost: order.productCost, unitSellingPrice: order.pricePaid, lineTotal: order.productCost, sellingLineTotal: order.pricePaid }];

  return (
    <DetailOverlay fallback="/orders" title={order.orderNumber || `Order #${order.rowIndex}`}>
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Order Info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-5">
          {/* Header: title + controls */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                  {order.orderNumber || `Order #${order.rowIndex}`}
                </h1>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                  {order.orderFrom} &middot; {order.orderDate}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setShowBill(true)} className="p-2 text-gray-400 hover:text-terracotta-600 hover:bg-terracotta-50 rounded-lg transition-colors" title="Generate Bill">
                  <FileText size={18} />
                </button>
                <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Order">
                  <Trash2 size={18} />
                </button>
                <StatusSelect currentStatus={order.orderStatus} onUpdate={handleStatusUpdate} />
              </div>
            </div>

            {/* Product lines */}
            <div className="mt-3 space-y-2">
              {productLines.map((line, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {line.articleId ? (
                        <Link to={`/inventory/${encodeURIComponent(line.articleId)}`} className="hover:text-terracotta-600">{line.productName}</Link>
                      ) : line.productName}
                    </span>
                    {line.category && <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{line.category}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>Qty: {line.quantity} &times; {formatCurrency(line.unitSellingPrice || line.unitCost)}</span>
                    <span className="font-semibold text-gray-700">{formatCurrency(line.sellingLineTotal || line.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Timeline */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Progress</h2>
            <div className="flex items-center">
              {STATUS_FLOW.map((status, i) => {
                const isActive = i <= currentStatusIndex;
                const isCurrent = status === order.orderStatus;
                const shortLabels = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for\nDelivery', 'Delivered'];
                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold ${
                        isCurrent ? 'bg-terracotta-600 text-white' :
                        isActive ? 'bg-green-500 text-white' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {isActive && !isCurrent ? '✓' : i + 1}
                      </div>
                      <span className={`text-[8px] md:text-[10px] mt-1 text-center leading-tight whitespace-pre-line ${isCurrent ? 'font-bold text-terracotta-600' : 'text-gray-400'}`}>
                        {shortLabels[i]}
                      </span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`h-0.5 w-full ${i < currentStatusIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {!STATUS_FLOW.includes(order.orderStatus) && (
              <div className="mt-3">
                <StatusBadge status={order.orderStatus} />
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 md:p-4">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Total Cost</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatCurrency(order.productCost)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Price Paid</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatCurrency(order.pricePaid)}</p>
            </div>
            {order.discount > 0 && (
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Discount</p>
                <p className="text-sm font-semibold text-red-600 mt-0.5">-{formatCurrency(order.discount)}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Payment</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{order.modeOfPayment}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Profit</p>
              <p className={`text-sm font-bold mt-0.5 ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(order.profit)}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-gray-400" />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Status</h2>
            </div>
            {!editingPayment && (
              <button onClick={openPaymentEditor}
                className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium">
                Change
              </button>
            )}
          </div>

          {paymentToast && (
            <p className={`text-xs mb-3 px-2 py-1 rounded ${paymentToast.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {paymentToast.msg}
            </p>
          )}

          {!editingPayment ? (
            <div className="space-y-2">
              <PaymentStatusBadge status={order.paymentStatus} />
              {order.paymentStatus === 'Partial Paid' && order.paidAmount > 0 && (
                <div className="text-xs text-gray-600 space-y-0.5 mt-2">
                  <p>Received: <span className="font-semibold text-green-700">{formatCurrency(order.paidAmount)}</span></p>
                  <p>Remaining: <span className="font-semibold text-red-600">{formatCurrency(order.pricePaid - order.paidAmount)}</span></p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_STATUSES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setPaymentForm(f => ({ ...f, status: s, amount: s === 'Partial Paid' ? f.amount : '' }))}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                      paymentForm.status === s
                        ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>{s}</button>
                ))}
              </div>
              {paymentForm.status === 'Partial Paid' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount Received</label>
                  <input type="number" min="0" max={order.pricePaid} step="0.01"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                    placeholder={`0 – ${order.pricePaid}`} />
                  <p className="text-[11px] text-gray-400 mt-0.5">Order total: {formatCurrency(order.pricePaid)}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handlePaymentSave} disabled={savingPayment}
                  className="px-3 py-1.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                  {savingPayment ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingPayment(false)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit History */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status History</h2>
          </div>
          {auditHistory.length === 0 ? (
            <p className="text-sm text-gray-400">No status history available</p>
          ) : (
            <div className="space-y-0">
              {[...auditHistory].reverse().map((entry, i) => {
                const dotColor = STATUS_COLORS[entry.newStatus]?.replace('text-', 'bg-').split(' ')[0] || 'bg-gray-300';
                return (
                  <div key={i} className="flex gap-3 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-1.5 ${dotColor}`} />
                      {i < auditHistory.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={entry.newStatus} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {entry.previousStatus ? `Changed from ${entry.previousStatus}` : 'Order created'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(entry.changedAt).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</h2>
            <div>
              {order.customerPhone ? (
                <Link to={`/customers/${encodeURIComponent(order.customerPhone)}`} className="font-medium text-gray-900 hover:text-terracotta-600 transition-colors">
                  {order.customerName}
                </Link>
              ) : (
                <p className="font-medium text-gray-900">{order.customerName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={14} />
              {order.customerPhone}
            </div>
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              {order.customerAddress}
            </div>
          </div>

          {/* Customer Order History */}
          {customerOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Other Orders ({customerOrders.length})
              </h2>
              <div className="space-y-3">
                {customerOrders.map(o => (
                  <Link
                    key={o.rowIndex}
                    to={`/orders/${o.rowIndex}`}
                    className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {o.productLines?.[0]?.productName || o.productOrdered}
                      {o.productLines?.length > 1 && <span className="text-xs text-terracotta-600 ml-1">(+{o.productLines.length - 1} more)</span>}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{o.orderDate}</span>
                      <StatusBadge status={o.orderStatus} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showBill && <BillModal order={order} onClose={() => setShowBill(false)} />}
      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}
    </div>
    </DetailOverlay>
  );
}
