import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Phone, MapPin, Package, CreditCard, Clock, FileText } from 'lucide-react';
import { fetchOrders, updateOrderStatus, fetchOrderAudit } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import StatusSelect from '../components/StatusSelect';
import DetailOverlay from '../components/DetailOverlay';
import Loader from '../components/Loader';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, ORDER_STATUSES, STATUS_COLORS } from '../utils/formatters';
import BillModal from '../components/BillModal';

const STATUS_FLOW = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

export default function OrderDetail() {
  const { rowIndex } = useParams();
  const [order, setOrder] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBill, setShowBill] = useState(false);

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
    <DetailOverlay fallback="/orders">
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {/* Invoice number as page title */}
              <h1 className="text-xl font-bold text-gray-900">
                {order.orderNumber || `Order #${order.rowIndex}`}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Order from {order.orderFrom} on {order.orderDate}
              </p>

              {/* Product lines — unified layout */}
              <div className="mt-3 space-y-2">
                {productLines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {line.articleId ? (
                          <Link to={`/inventory/${encodeURIComponent(line.articleId)}`} className="hover:text-terracotta-600">{line.productName}</Link>
                        ) : line.productName}
                      </span>
                      {line.category && <span className="ml-2 text-xs text-gray-500">{line.category}</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      &times;{line.quantity} &middot; {formatCurrency(line.unitSellingPrice || line.unitCost)}/unit &middot; <span className="font-medium">{formatCurrency(line.sellingLineTotal || line.lineTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button onClick={() => setShowBill(true)} className="p-2 text-gray-400 hover:text-terracotta-600 hover:bg-terracotta-50 rounded-lg transition-colors" title="Generate Bill">
                <FileText size={18} />
              </button>
              <StatusSelect currentStatus={order.orderStatus} onUpdate={handleStatusUpdate} />
            </div>
          </div>

          {/* Status Timeline */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Progress</h2>
            <div className="flex items-center gap-1">
              {STATUS_FLOW.map((status, i) => {
                const isActive = i <= currentStatusIndex;
                const isCurrent = status === order.orderStatus;
                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent ? 'bg-terracotta-600 text-white' :
                        isActive ? 'bg-green-500 text-white' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {isActive && !isCurrent ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] mt-1 text-center ${isCurrent ? 'font-bold text-terracotta-600' : 'text-gray-400'}`}>
                        {status}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Package size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Cost</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.productCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Price Paid</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.pricePaid)}</p>
              </div>
            </div>
            {order.discount > 0 && (
              <div className="flex items-center gap-3">
                <CreditCard size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Discount</p>
                  <p className="text-sm font-medium text-red-600">-{formatCurrency(order.discount)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Payment Mode</p>
                <p className="text-sm font-medium text-gray-900">{order.modeOfPayment}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Profit</p>
              <p className={`text-sm font-bold ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(order.profit)}
              </p>
            </div>
          </div>
        </div>

        {/* Audit History */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Status History</h2>
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
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Customer</h2>
            <div>
              <p className="font-medium text-gray-900">{order.customerName}</p>
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
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
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
    </div>
    </DetailOverlay>
  );
}
