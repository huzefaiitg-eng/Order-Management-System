const express = require('express');
const router = express.Router();
const { getAllOrders, updateOrderStatus, updatePaymentStatus, addOrder, getOrderStatus, addAuditEntry, getAuditHistory, getAllCustomers, getAllInventory, adjustStock, getOrderByRowIndex } = require('../services/sheets');

const VALID_STATUSES = [
  'Pending', 'Confirmed', 'Packed', 'Shipped',
  'Out for Delivery', 'Delivered', 'Returned', 'Cancelled', 'Refunded',
];

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const [rawOrders, customers, inventory] = await Promise.all([getAllOrders(sheetId), getAllCustomers(sheetId), getAllInventory(sheetId)]);

    const customerMap = {};
    customers.forEach(c => {
      if (c.customerPhone) customerMap[c.customerPhone] = c;
    });

    const productMap = {};
    inventory.forEach(p => {
      if (p.productName) productMap[p.productName] = p;
    });

    let orders = rawOrders.map(order => {
      const masterCustomer = customerMap[order.customerPhone];
      const enrichedLines = order.productLines.map(line => {
        const mp = productMap[line.productName];
        return {
          ...line,
          articleId: mp?.articleId || '',
          productDescription: mp?.productDescription || '',
          category: mp?.category || '',
          subCategory: mp?.subCategory || '',
          productImages: mp?.productImages || '',
        };
      });
      const firstProduct = productMap[order.productLines[0]?.productName];
      return {
        ...order,
        customerName: masterCustomer?.customerName || order.customerName,
        customerAddress: masterCustomer?.customerAddress || order.customerAddress,
        articleId: firstProduct?.articleId || '',
        productDescription: firstProduct?.productDescription || '',
        category: firstProduct?.category || '',
        subCategory: firstProduct?.subCategory || '',
        productImages: firstProduct?.productImages || '',
        productLines: enrichedLines,
      };
    });

    const { source, status, payment, search, startDate, endDate } = req.query;

    if (source) {
      const vals = source.split(',').map(s => s.trim().toLowerCase());
      orders = orders.filter(o => vals.includes(o.orderFrom.toLowerCase()));
    }
    if (status) {
      const vals = status.split(',').map(s => s.trim().toLowerCase());
      orders = orders.filter(o => vals.includes(o.orderStatus.toLowerCase()));
    }
    if (payment) {
      const vals = payment.split(',').map(p => p.trim().toLowerCase());
      orders = orders.filter(o => vals.includes(o.modeOfPayment.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.productOrdered.toLowerCase().includes(q)
      );
    }
    if (startDate) orders = orders.filter(o => parseDate(o.orderDate) >= new Date(startDate));
    if (endDate) orders = orders.filter(o => parseDate(o.orderDate) <= new Date(endDate));

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { orderFrom, customerName, customerPhone, customerAddress, productLines, pricePaid, modeOfPayment, discount } = req.body;

    // Support both productLines array (multi-product) and legacy single-product fields
    let productOrdered, productCost, quantityOrdered, sellingPrice;
    if (productLines && Array.isArray(productLines) && productLines.length > 0) {
      productOrdered = productLines.map(l => l.productName);
      productCost = productLines.map(l => l.unitCost || 0);
      quantityOrdered = productLines.map(l => l.quantity || 1);
      sellingPrice = productLines.map(l => l.unitSellingPrice || 0);
    } else {
      productOrdered = req.body.productOrdered;
      productCost = req.body.productCost || 0;
      quantityOrdered = req.body.quantityOrdered || 1;
      sellingPrice = req.body.sellingPrice || 0;
    }

    const productCheck = Array.isArray(productOrdered) ? productOrdered[0] : productOrdered;
    if (!orderFrom || !customerName || !customerPhone || !productCheck || !modeOfPayment) {
      return res.status(400).json({ success: false, error: 'Missing required fields: orderFrom, customerName, customerPhone, productOrdered, modeOfPayment' });
    }

    const orderDate = req.body.orderDate || new Date().toLocaleDateString('en-GB');

    const result = await addOrder(sheetId, {
      orderFrom, orderDate, customerName, customerPhone,
      customerAddress: customerAddress || '',
      modeOfPayment, productOrdered,
      productCost,
      quantityOrdered,
      pricePaid: pricePaid || 0,
      sellingPrice,
      discount: parseFloat(discount) || 0,
    });

    await addAuditEntry(sheetId, { orderRowIndex: result.rowIndex, previousStatus: '', newStatus: 'Pending' });

    // Stock side-effect: decrement instockQuantity for every product in this order
    try {
      const inv = await getAllInventory(sheetId);
      const lines = result.productLines || [];
      for (const line of lines) {
        if (!line.productName) continue;
        const qty = parseInt(line.quantity) || 0;
        if (qty <= 0) continue;
        const product = inv.find(p => p.productName === line.productName);
        if (!product) continue;
        await adjustStock(sheetId, product.articleId, {
          delta: -qty,
          reason: `Order ${result.orderNumber || `#${result.rowIndex}`} placed (row ${result.rowIndex})`,
          changeType: 'order-placed',
        });
      }
    } catch (err) {
      console.error('Stock side-effect error on order creation:', err.message);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding order:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/orders/:rowIndex/audit
router.get('/:rowIndex/audit', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const entries = await getAuditHistory(sheetId, parseInt(req.params.rowIndex));
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching audit history:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/orders/:rowIndex
router.patch('/:rowIndex', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const rowIndex = parseInt(req.params.rowIndex);
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const currentStatus = await getOrderStatus(sheetId, rowIndex);
    const result = await updateOrderStatus(sheetId, rowIndex, status);
    await addAuditEntry(sheetId, { orderRowIndex: rowIndex, previousStatus: currentStatus, newStatus: status });

    // Stock side-effects: restore stock when entering Returned/Cancelled/Refunded,
    // re-consume stock when exiting those statuses (e.g. re-activating an order).
    const RESTORE_STATUSES = ['Returned', 'Cancelled', 'Refunded'];
    const enteringRestore = RESTORE_STATUSES.includes(status) && !RESTORE_STATUSES.includes(currentStatus);
    const exitingRestore = RESTORE_STATUSES.includes(currentStatus) && !RESTORE_STATUSES.includes(status);
    if (enteringRestore || exitingRestore) {
      try {
        const [order, inv] = await Promise.all([getOrderByRowIndex(sheetId, rowIndex), getAllInventory(sheetId)]);
        if (order && order.productLines && order.productLines.length > 0) {
          for (const line of order.productLines) {
            if (!line.productName) continue;
            const qty = parseInt(line.quantity) || 0;
            if (qty <= 0) continue;
            const product = inv.find(p => p.productName === line.productName);
            if (!product) continue;
            const delta = enteringRestore ? +qty : -qty;
            const changeType = enteringRestore ? 'order-restored' : 'order-reactivated';
            const reason = enteringRestore
              ? `Order ${order.orderNumber || `#${rowIndex}`} ${status.toLowerCase()} — stock restored (row ${rowIndex})`
              : `Order ${order.orderNumber || `#${rowIndex}`} reactivated from ${currentStatus} → ${status} (row ${rowIndex})`;
            await adjustStock(sheetId, product.articleId, { delta, reason, changeType });
          }
        }
      } catch (err) {
        console.error('Stock side-effect error on order status change:', err.message);
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating order status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const VALID_PAYMENT_STATUSES = ['Unpaid', 'Partial Paid', 'Fully Paid'];

// PATCH /api/orders/:rowIndex/payment — update payment status (and optional partial amount)
router.patch('/:rowIndex/payment', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const rowIndex = parseInt(req.params.rowIndex);
    const { paymentStatus, paidAmount } = req.body;

    if (!paymentStatus || !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid paymentStatus. Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`,
      });
    }

    const resolvedPaidAmount = paymentStatus === 'Unpaid' ? 0 : (parseFloat(paidAmount) || 0);
    const result = await updatePaymentStatus(sheetId, rowIndex, { paymentStatus, paidAmount: resolvedPaidAmount });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating payment status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(dateStr);
}

module.exports = router;
