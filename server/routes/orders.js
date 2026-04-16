const express = require('express');
const router = express.Router();
const { getAllOrders, updateOrderStatus, addOrder, getOrderStatus, addAuditEntry, getAuditHistory, getAllCustomers, getAllInventory, adjustStock, getOrderByRowIndex } = require('../services/sheets');

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

    // Stock side-effects when a Delivered transition happens in either direction
    const enteringDelivered = status === 'Delivered' && currentStatus !== 'Delivered';
    const exitingDelivered = currentStatus === 'Delivered' && status !== 'Delivered';
    if (enteringDelivered || exitingDelivered) {
      try {
        const [order, inv] = await Promise.all([getOrderByRowIndex(sheetId, rowIndex), getAllInventory(sheetId)]);
        if (order && order.productLines && order.productLines.length > 0) {
          for (const line of order.productLines) {
            if (!line.productName) continue;
            const qty = parseInt(line.quantity) || 0;
            if (qty <= 0) continue;
            const product = inv.find(p => p.productName === line.productName);
            if (!product) continue;
            const delta = enteringDelivered ? -qty : +qty;
            const reason = enteringDelivered
              ? `Order ${order.orderNumber || `#${rowIndex}`} delivered (row ${rowIndex})`
              : `Order ${order.orderNumber || `#${rowIndex}`} delivery reversed → ${status} (row ${rowIndex})`;
            await adjustStock(sheetId, product.articleId, {
              delta,
              reason,
              changeType: enteringDelivered ? 'delivered' : 'delivery-reversed',
            });
          }
        }
      } catch (err) {
        // Log but don't fail the status update — user shouldn't lose their status change if audit logging breaks
        console.error('Stock side-effect error on order status change:', err.message);
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating order status:', error.message);
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
