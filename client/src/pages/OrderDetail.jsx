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
    </div>
    </DetailOverlay>
  );
}
