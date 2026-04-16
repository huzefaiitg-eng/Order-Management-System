const express = require('express');
const router = express.Router();
const {
  getAllInventory, getProductByArticleId, getAllOrders,
  addProduct, updateProduct, archiveProduct, unarchiveProduct, deleteProduct,
  adjustStock, getInventoryAuditHistory,
} = require('../services/sheets');

// An order is ACTIVE unless it has reached a terminal state.
// Anything that's not Delivered / Returned / Cancelled / Refunded is active.
const TERMINAL_STATUSES = ['Delivered', 'Returned', 'Cancelled', 'Refunded'];
const isActiveOrder = (status) => {
  if (!status) return false;
  return !TERMINAL_STATUSES.includes(String(status).trim());
};

router.get('/summary', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const [products, orders] = await Promise.all([getAllInventory(sheetId), getAllOrders(sheetId)]);

    // Compute dynamic active order quantities using productLines for proper per-product matching
    const activeQtyByProduct = {};
    orders.forEach(order => {
      if (!isActiveOrder(order.orderStatus)) return;
      (order.productLines || []).forEach(line => {
        if (!line.productName) return;
        activeQtyByProduct[line.productName] = (activeQtyByProduct[line.productName] || 0) + (line.quantity || 1);
      });
    });

    const activeProducts = products.filter(p => p.status === 'Active' || !p.status).map(p => ({
      ...p,
      quantityInActiveOrders: activeQtyByProduct[p.productName] || 0,
      availableQuantity: p.instockQuantity - (activeQtyByProduct[p.productName] || 0),
    }));

    const totalProducts = activeProducts.length;
    const totalInventoryValue = activeProducts.reduce((sum, p) => sum + (p.productCost * p.instockQuantity), 0);
    const lowStockCount = activeProducts.filter(p => p.availableQuantity > 0 && p.availableQuantity < (p.minStock || 5)).length;
    const outOfStockCount = activeProducts.filter(p => p.instockQuantity === 0).length;

    const categoryBreakdown = {};
    activeProducts.forEach(p => {
      if (!categoryBreakdown[p.category]) categoryBreakdown[p.category] = { count: 0, value: 0 };
      categoryBreakdown[p.category].count++;
      categoryBreakdown[p.category].value += p.productCost * p.instockQuantity;
    });

    res.json({ success: true, data: { totalProducts, totalInventoryValue, lowStockCount, outOfStockCount, categoryBreakdown } });
  } catch (error) {
    console.error('Error fetching inventory summary:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const { productName, category, subCategory, productCost, sellingPrice, instockQuantity, productDescription, productImages, minStock, maxStock } = req.body;
    if (!productName || !category || !subCategory || productCost === undefined || instockQuantity === undefined) {
      return res.status(400).json({ success: false, error: 'Product name, category, sub-category, cost, and instock quantity are required' });
    }
    const newProduct = await addProduct(sheetId, {
      productName, productDescription, category, subCategory, productImages,
      productCost: parseFloat(productCost),
      sellingPrice: parseFloat(sellingPrice) || 0,
      instockQuantity: parseInt(instockQuantity),
      minStock: minStock !== undefined ? parseInt(minStock) : undefined,
      maxStock: maxStock !== undefined ? parseInt(maxStock) : undefined,
    });
    res.json({ success: true, data: newProduct });
  } catch (error) {
    console.error('Error adding product:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const [products, orders] = await Promise.all([getAllInventory(sheetId), getAllOrders(sheetId)]);

    const productStats = {};
    orders.forEach(order => {
      const active = isActiveOrder(order.orderStatus);
      (order.productLines || []).forEach(line => {
        const name = line.productName;
        if (!name) return;
        if (!productStats[name]) productStats[name] = { totalOrders: 0, totalRevenue: 0, returnedCount: 0, activeOrderCount: 0, activeQty: 0 };
        productStats[name].totalOrders++;
        productStats[name].totalRevenue += line.sellingLineTotal || line.lineTotal || 0;
        if (order.orderStatus === 'Returned') productStats[name].returnedCount++;
        if (active) {
          productStats[name].activeOrderCount++;
          productStats[name].activeQty += (line.quantity || 1);
        }
      });
    });

    let result = products.map(p => {
      const stats = productStats[p.productName] || { totalOrders: 0, totalRevenue: 0, returnedCount: 0, activeOrderCount: 0, activeQty: 0 };
      const quantityInActiveOrders = stats.activeQty;
      return {
        ...p,
        totalOrders: stats.totalOrders, totalRevenue: stats.totalRevenue, returnedCount: stats.returnedCount,
        activeOrderCount: stats.activeOrderCount,
        quantityInActiveOrders,
        availableQuantity: p.instockQuantity - quantityInActiveOrders,
      };
    });

    const statusFilter = req.query.status || 'Active';
    result = result.filter(p => p.status === statusFilter);

    const { search, category, subCategory } = req.query;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.productName.toLowerCase().includes(q) || p.articleId.toLowerCase().includes(q) || p.productDescription.toLowerCase().includes(q));
    }
    if (category) result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
    if (subCategory) result = result.filter(p => p.subCategory.toLowerCase() === subCategory.toLowerCase());

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching inventory:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:articleId/archive', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    const updated = await archiveProduct(sheetId, articleId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error archiving product:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.patch('/:articleId/unarchive', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    const updated = await unarchiveProduct(sheetId, articleId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error unarchiving product:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.delete('/:articleId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    await deleteProduct(sheetId, articleId);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting product:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

router.get('/:articleId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    const [product, orders] = await Promise.all([getProductByArticleId(sheetId, articleId), getAllOrders(sheetId)]);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const productOrders = orders.filter(o =>
      (o.productLines || []).some(l => l.productName === product.productName)
    );
    const totalRevenue = productOrders.reduce((sum, o) => sum + o.pricePaid, 0);
    const totalProfit = productOrders.reduce((sum, o) => sum + o.profit, 0);
    const returnedCount = productOrders.filter(o => o.orderStatus === 'Returned').length;

    // Active orders = orders not in Delivered/Returned/Cancelled/Refunded
    const activeOrders = productOrders.filter(o => isActiveOrder(o.orderStatus));
    const activeOrderCount = activeOrders.length;
    const quantityInActiveOrders = activeOrders.reduce((sum, o) => {
      const line = (o.productLines || []).find(l => l.productName === product.productName);
      return sum + (line ? line.quantity || 1 : 1);
    }, 0);

    res.json({
      success: true,
      data: {
        ...product,
        activeOrderCount,
        quantityInActiveOrders,
        availableQuantity: product.instockQuantity - quantityInActiveOrders,
        totalOrders: productOrders.length, totalRevenue, totalProfit,
        returnRate: productOrders.length > 0 ? returnedCount / productOrders.length : 0,
        averageMargin: productOrders.length > 0 ? totalProfit / productOrders.length : 0,
        orders: productOrders,
      },
    });
  } catch (error) {
    console.error('Error fetching product:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:articleId', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    const updates = req.body;
    if (updates.productCost !== undefined) updates.productCost = parseFloat(updates.productCost);
    if (updates.sellingPrice !== undefined) updates.sellingPrice = parseFloat(updates.sellingPrice);
    if (updates.instockQuantity !== undefined) updates.instockQuantity = parseInt(updates.instockQuantity);
    if (updates.minStock !== undefined) updates.minStock = parseInt(updates.minStock);
    if (updates.maxStock !== undefined) updates.maxStock = parseInt(updates.maxStock);
    const updated = await updateProduct(sheetId, articleId, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating product:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

// POST /:articleId/stock — manual restock/adjust with audit entry
router.post('/:articleId/stock', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    const { delta, reason, changeType } = req.body;
    const deltaNum = parseInt(delta);
    if (!Number.isFinite(deltaNum) || deltaNum === 0) {
      return res.status(400).json({ success: false, error: 'delta is required and must be a non-zero integer' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, error: 'reason is required' });
    }
    const resolvedType = changeType === 'restock' || changeType === 'adjust' ? changeType : (deltaNum > 0 ? 'restock' : 'adjust');
    const updated = await adjustStock(sheetId, articleId, { delta: deltaNum, reason: String(reason).trim(), changeType: resolvedType });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error adjusting stock:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

// GET /:articleId/stock-audit — inventory audit history for a product
router.get('/:articleId/stock-audit', async (req, res) => {
  try {
    const { sheetId } = req.user;
    const articleId = decodeURIComponent(req.params.articleId);
    const entries = await getInventoryAuditHistory(sheetId, articleId);
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching stock audit:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
