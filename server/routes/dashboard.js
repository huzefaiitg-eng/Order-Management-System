const express = require('express');
const router = express.Router();
const { getAllOrders, getAllCustomers, getAllInventory } = require('../services/sheets');

// GET /api/dashboard
// Returns raw orders + customer/inventory summary KPIs.
// Per-card filtering & aggregation now happens client-side so that fetching is
// a single round-trip even when the user slices multiple cards independently.
router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const [orders, customers, inventory] = await Promise.all([
      getAllOrders(sheetId),
      getAllCustomers(sheetId),
      getAllInventory(sheetId),
    ]);

    // Soft warning: if order volume grows very large, revisit server-side
    // aggregation so we don't balloon the payload.
    if (orders.length > 10000) {
      console.warn(`[dashboard] Large order payload: ${orders.length} rows. Consider server-side aggregation.`);
    }

    // Strip each order to only the fields the dashboard uses.
    const trimmedOrders = orders.map(o => ({
      rowIndex: o.rowIndex,
      orderDate: o.orderDate,
      orderFrom: o.orderFrom,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      productLines: Array.isArray(o.productLines)
        ? o.productLines.map(l => ({ productName: l.productName }))
        : [],
      pricePaid: o.pricePaid,
      profit: o.profit,
      orderStatus: o.orderStatus,
      modeOfPayment: o.modeOfPayment,
    }));

    // Customer KPIs (always full dataset, not date-filtered)
    const activeCustomers = customers.filter(
      c => c.status !== 'Archived' && c.anyActiveOrder === 'Yes'
    ).length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentPhones = new Set(
      orders.filter(o => {
        const d = parseDate(o.orderDate);
        return d && d >= sevenDaysAgo;
      }).map(o => o.customerPhone).filter(Boolean)
    );
    const newCustomers7d = recentPhones.size;

    // Inventory KPIs (always full dataset) — compute dynamic available quantities
    const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];
    const activeQtyByProduct = {};
    orders.forEach(o => {
      const name = o.productOrdered;
      if (!name) return;
      if (ACTIVE_STATUSES.includes(o.orderStatus)) {
        activeQtyByProduct[name] = (activeQtyByProduct[name] || 0) + (o.quantityOrdered || 1);
      }
    });

    const activeInventory = inventory.filter(p => p.status !== 'Archived').map(p => ({
      ...p,
      availableQuantity: p.instockQuantity - (activeQtyByProduct[p.productName] || 0),
    }));
    const outOfStockCount = activeInventory.filter(p => p.instockQuantity === 0).length;
    const lowStockCount = activeInventory.filter(p => p.availableQuantity > 0 && p.availableQuantity < 5).length;

    res.json({
      success: true,
      data: {
        orders: trimmedOrders,
        customerKpis: {
          totalCustomers: customers.filter(c => c.status !== 'Archived').length,
          activeCustomers,
          newCustomers7d,
        },
        inventoryKpis: {
          totalInventory: inventory.filter(p => p.status !== 'Archived').length,
          lowStockCount,
          outOfStockCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error.message);
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
