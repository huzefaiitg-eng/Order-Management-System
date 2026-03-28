const express = require('express');
const router = express.Router();
const { getAllOrders, getAllCustomers, getCustomerByPhone } = require('../services/sheets');

const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];

// GET /api/customers — master list from Customers sheet, enriched with live order counts
router.get('/', async (req, res) => {
  try {
    const [customers, orders] = await Promise.all([getAllCustomers(), getAllOrders()]);

    // Build order stats by phone number
    const orderStats = {};
    orders.forEach(order => {
      const phone = order.customerPhone;
      if (!phone) return;
      if (!orderStats[phone]) {
        orderStats[phone] = { totalOrders: 0, activeOrderCount: 0 };
      }
      orderStats[phone].totalOrders++;
      if (ACTIVE_STATUSES.includes(order.orderStatus)) {
        orderStats[phone].activeOrderCount++;
      }
    });

    let result = customers.map(c => {
      const stats = orderStats[c.customerPhone] || { totalOrders: 0, activeOrderCount: 0 };
      return {
        customerId: c.customerId,
        customerName: c.customerName,
        customerPhone: c.customerPhone,
        customerAddress: c.customerAddress,
        // Live computed values from orders (override sheet values)
        totalOrders: stats.totalOrders,
        activeOrderCount: stats.activeOrderCount,
        // Original sheet values for reference
        sheetOrderCount: c.numberOfOrders,
        sheetActiveOrder: c.anyActiveOrder,
      };
    });

    const { search } = req.query;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.customerAddress.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => b.totalOrders - a.totalOrders);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching customers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:phone — single customer from master sheet + full order history
router.get('/:phone', async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const [customer, orders] = await Promise.all([
      getCustomerByPhone(phone),
      getAllOrders(),
    ]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found in master sheet' });
    }

    const customerOrders = orders.filter(o => o.customerPhone === phone);

    const data = {
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      customerAddress: customer.customerAddress,
      totalOrders: customerOrders.length,
      activeOrderCount: customerOrders.filter(o => ACTIVE_STATUSES.includes(o.orderStatus)).length,
      totalSpent: customerOrders.reduce((sum, o) => sum + o.pricePaid, 0),
      orders: customerOrders,
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
