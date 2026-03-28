const express = require('express');
const router = express.Router();
const { getAllOrders, updateOrderStatus, getAllCustomers, getAllInventory } = require('../services/sheets');

const VALID_STATUSES = [
  'Pending', 'Confirmed', 'Packed', 'Shipped',
  'Out for Delivery', 'Delivered', 'Returned', 'Cancelled', 'Refunded',
];

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const [rawOrders, customers, inventory] = await Promise.all([getAllOrders(), getAllCustomers(), getAllInventory()]);

    // Build customer lookup by phone from master Customers sheet
    const customerMap = {};
    customers.forEach(c => {
      if (c.customerPhone) customerMap[c.customerPhone] = c;
    });

    // Build product lookup by name from master Inventory sheet
    const productMap = {};
    inventory.forEach(p => {
      if (p.productName) productMap[p.productName] = p;
    });

    // Enrich orders with master customer + inventory data
    let orders = rawOrders.map(order => {
      const masterCustomer = customerMap[order.customerPhone];
      const masterProduct = productMap[order.productOrdered];
      return {
        ...order,
        // Customer enrichment
        customerName: masterCustomer?.customerName || order.customerName,
        customerAddress: masterCustomer?.customerAddress || order.customerAddress,
        // Product enrichment from inventory
        articleId: masterProduct?.articleId || '',
        productDescription: masterProduct?.productDescription || '',
        category: masterProduct?.category || '',
        subCategory: masterProduct?.subCategory || '',
        productImages: masterProduct?.productImages || '',
      };
    });

    const { source, status, payment, search, startDate, endDate } = req.query;

    if (source) {
      orders = orders.filter(o => o.orderFrom.toLowerCase() === source.toLowerCase());
    }
    if (status) {
      orders = orders.filter(o => o.orderStatus.toLowerCase() === status.toLowerCase());
    }
    if (payment) {
      orders = orders.filter(o => o.modeOfPayment.toLowerCase() === payment.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.productOrdered.toLowerCase().includes(q)
      );
    }
    if (startDate) {
      orders = orders.filter(o => parseDate(o.orderDate) >= new Date(startDate));
    }
    if (endDate) {
      orders = orders.filter(o => parseDate(o.orderDate) <= new Date(endDate));
    }

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/orders/:rowIndex
router.patch('/:rowIndex', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const result = await updateOrderStatus(rowIndex, status);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating order status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  // Handle DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(dateStr);
}

module.exports = router;
