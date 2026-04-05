const express = require('express');
const router = express.Router();
const {
  getAllOrders, getAllCustomers, getCustomerByPhone,
  addCustomer, updateCustomer, archiveCustomer, unarchiveCustomer, deleteCustomer,
} = require('../services/sheets');

const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];

router.post('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { customerName, customerPhone, customerAddress, customerEmail } = req.body;
    if (!customerName || !customerPhone) {
      return res.status(400).json({ success: false, error: 'Customer name and phone are required' });
    }
    const newCustomer = await addCustomer(sheetId, { customerName, customerPhone, customerAddress, customerEmail });
    res.json({ success: true, data: newCustomer });
  } catch (error) {
    console.error('Error adding customer:', error.message);
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const [customers, orders] = await Promise.all([getAllCustomers(sheetId), getAllOrders(sheetId)]);

    const orderStats = {};
    orders.forEach(order => {
      const phone = order.customerPhone;
      if (!phone) return;
      if (!orderStats[phone]) orderStats[phone] = { totalOrders: 0, activeOrderCount: 0 };
      orderStats[phone].totalOrders++;
      if (ACTIVE_STATUSES.includes(order.orderStatus)) orderStats[phone].activeOrderCount++;
    });

    let result = customers.map(c => {
      const stats = orderStats[c.customerPhone] || { totalOrders: 0, activeOrderCount: 0 };
      return {
        customerId: c.customerId, customerName: c.customerName, customerPhone: c.customerPhone,
        customerAddress: c.customerAddress, customerEmail: c.customerEmail, status: c.status,
        totalOrders: stats.totalOrders, activeOrderCount: stats.activeOrderCount,
        sheetOrderCount: c.numberOfOrders, sheetActiveOrder: c.anyActiveOrder,
      };
    });

    const statusFilter = req.query.status || 'Active';
    result = result.filter(c => c.status === statusFilter);

    if (req.query.hasActiveOrders === 'true') {
      result = result.filter(c => c.activeOrderCount > 0);
    }

    const { search } = req.query;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.customerName.toLowerCase().includes(q) || c.customerPhone.includes(q) ||
        c.customerAddress.toLowerCase().includes(q) || c.customerEmail.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => b.totalOrders - a.totalOrders);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching customers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:phone/archive', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const phone = decodeURIComponent(req.params.phone);
    const updated = await archiveCustomer(sheetId, phone);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error archiving customer:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.patch('/:phone/unarchive', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const phone = decodeURIComponent(req.params.phone);
    const updated = await unarchiveCustomer(sheetId, phone);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error unarchiving customer:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.delete('/:phone', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const phone = decodeURIComponent(req.params.phone);
    await deleteCustomer(sheetId, phone);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting customer:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.get('/:phone', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const phone = decodeURIComponent(req.params.phone);
    const [customer, orders] = await Promise.all([getCustomerByPhone(sheetId, phone), getAllOrders(sheetId)]);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found in master sheet' });

    const customerOrders = orders.filter(o => o.customerPhone === phone);
    res.json({
      success: true,
      data: {
        customerId: customer.customerId, customerName: customer.customerName,
        customerPhone: customer.customerPhone, customerAddress: customer.customerAddress,
        customerEmail: customer.customerEmail, status: customer.status,
        totalOrders: customerOrders.length,
        activeOrderCount: customerOrders.filter(o => ACTIVE_STATUSES.includes(o.orderStatus)).length,
        totalSpent: customerOrders.reduce((sum, o) => sum + o.pricePaid, 0),
        orders: customerOrders,
      },
    });
  } catch (error) {
    console.error('Error fetching customer:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:phone', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const phone = decodeURIComponent(req.params.phone);
    const updated = await updateCustomer(sheetId, phone, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating customer:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

module.exports = router;
