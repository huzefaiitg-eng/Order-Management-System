/**
 * seed-stock.js — One-time reconciliation for the demo account.
 *
 * 1. Sets per-product minStock / maxStock values.
 * 2. Reads all past orders and computes how many units each product
 *    should have lost to non-returned / non-cancelled / non-refunded orders.
 * 3. Adjusts instockQuantity accordingly and writes audit entries
 *    so the Inventory Audit tab shows the reconciliation.
 *
 * Usage:  cd server && node seed-stock.js
 */

const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// ── Config ─────────────────────────────────────────────────
const RESTORE_STATUSES = ['Returned', 'Cancelled', 'Refunded'];

// Per-product thresholds (keyed by product name).
// Products not listed here get the defaults below.
const THRESHOLDS = {
  'Classic Leather Loafers':    { min: 8,  max: 30 },
  'Running Sneakers Pro':       { min: 10, max: 40 },
  'Casual Canvas Slip-On':      { min: 12, max: 50 },
  'Formal Oxford Black':        { min: 5,  max: 20 },
  'Sports Training Shoes':      { min: 8,  max: 35 },
  'Suede Chelsea Boots':        { min: 5,  max: 25 },
  'Lightweight Joggers':        { min: 10, max: 40 },
  'Premium Brogue Tan':         { min: 5,  max: 20 },
  'High-Top Basketball Shoes':  { min: 6,  max: 25 },
  'Mesh Walking Shoes':         { min: 10, max: 45 },
  'Sandal Comfort Plus':        { min: 15, max: 60 },
  'Flip Flop Daily':            { min: 20, max: 80 },
  'Hiking Trail Boots':         { min: 5,  max: 20 },
  'Office Derby Brown':         { min: 6,  max: 25 },
  'Ethnic Mojari Gold':         { min: 8,  max: 30 },
  'Kids Velcro Sneakers':       { min: 10, max: 40 },
  'Women Stiletto Heels':       { min: 6,  max: 25 },
  'Flat Ballerina Pink':        { min: 8,  max: 35 },
  'Ankle Boot Zipper':          { min: 6,  max: 25 },
  'Ankle Boot Zipper Pro':      { min: 6,  max: 25 },
  'Kolhapuri Chappal':          { min: 10, max: 40 },
};
const DEFAULT_MIN = 5;
const DEFAULT_MAX = 30;

// ── Helpers ────────────────────────────────────────────────

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function run() {
  const sheets = await getSheets();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID env var is required');

  // ── 1. Read current inventory ──────────────────────────
  const invRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Inventory!A2:M',
  });
  const invRows = invRes.data.values || [];

  const products = invRows.map((row, i) => ({
    rowIndex: i + 2,
    articleId: row[0] || '',
    productName: row[1] || '',
    instockQuantity: parseInt(row[8]) || 0,
    status: row[10] || 'Active',
  }));

  console.log(`Found ${products.length} products in Inventory sheet.`);

  // ── 2. Read all orders ─────────────────────────────────
  const ordersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Orders!A2:N',
  });
  const orderRows = ordersRes.data.values || [];
  console.log(`Found ${orderRows.length} orders.`);

  // Compute consumed qty per product name.
  // "Consumed" = ordered AND not in Returned/Cancelled/Refunded.
  const consumedByProduct = {};
  orderRows.forEach(row => {
    const orderStatus = (row[10] || '').trim();
    if (RESTORE_STATUSES.includes(orderStatus)) return; // skip returned/cancelled/refunded

    const productsRaw = (row[6] || '').split('|').map(s => s.trim()).filter(Boolean);
    const qtysRaw = (row[8] || '1').split('|').map(s => parseInt(s.trim()) || 1);

    productsRaw.forEach((name, idx) => {
      const qty = qtysRaw[idx] || 1;
      consumedByProduct[name] = (consumedByProduct[name] || 0) + qty;
    });
  });

  console.log('\nConsumed quantities by product:');
  Object.entries(consumedByProduct).sort((a, b) => b[1] - a[1]).forEach(([name, qty]) => {
    console.log(`  ${name}: ${qty} units`);
  });

  // ── 3. Check existing Inventory Audit entries ──────────
  // So we don't double-count adjustments already made by the Delivered hook or manual restocks.
  let existingAuditDelta = {}; // articleId → net delta already applied
  try {
    const auditRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Inventory Audit'!A2:H",
    });
    const auditRows = auditRes.data.values || [];
    auditRows.forEach(row => {
      const artId = row[0] || '';
      const delta = parseInt(row[5]) || 0;
      existingAuditDelta[artId] = (existingAuditDelta[artId] || 0) + delta;
    });
    console.log(`\nExisting audit entries found for ${Object.keys(existingAuditDelta).length} products.`);
  } catch (err) {
    console.log('\nNo existing Inventory Audit entries (tab may be empty).');
  }

  // ── 4. Compute adjustments ─────────────────────────────
  const batchUpdates = [];
  const auditEntries = [];
  const now = new Date().toISOString();

  for (const product of products) {
    if (product.status === 'Archived') continue;

    const consumed = consumedByProduct[product.productName] || 0;
    const alreadyAdjusted = existingAuditDelta[product.articleId] || 0;

    // The current instockQuantity already has `alreadyAdjusted` baked in.
    // The "original" stock before any audit adjustments was:
    const originalStock = product.instockQuantity - alreadyAdjusted;
    // The correct stock under the new model should be:
    const correctStock = Math.max(0, originalStock - consumed);
    const delta = correctStock - product.instockQuantity;

    // Set min/max thresholds
    const thresholds = THRESHOLDS[product.productName] || { min: DEFAULT_MIN, max: DEFAULT_MAX };

    // Always write minStock (col L) and maxStock (col M)
    batchUpdates.push({
      range: `Inventory!L${product.rowIndex}:M${product.rowIndex}`,
      values: [[thresholds.min, thresholds.max]],
    });

    if (delta !== 0) {
      // Update instockQuantity
      batchUpdates.push({
        range: `Inventory!I${product.rowIndex}`,
        values: [[correctStock]],
      });

      // Audit entry
      auditEntries.push([
        product.articleId,
        product.productName,
        'reconciliation',
        String(product.instockQuantity),
        String(correctStock),
        String(delta),
        `Stock reconciliation — ${consumed} units consumed across ${orderRows.length} orders`,
        now,
      ]);

      console.log(`\n${product.productName} (${product.articleId}):`);
      console.log(`  Original stock: ${originalStock}, Consumed: ${consumed}, Already adjusted: ${alreadyAdjusted}`);
      console.log(`  Current: ${product.instockQuantity} → Correct: ${correctStock} (delta: ${delta})`);
      console.log(`  Min: ${thresholds.min}, Max: ${thresholds.max}`);
    } else {
      console.log(`\n${product.productName}: stock OK (${product.instockQuantity}), setting min=${thresholds.min} max=${thresholds.max}`);
    }
  }

  // ── 5. Write batch updates ─────────────────────────────
  if (batchUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data: batchUpdates },
    });
    console.log(`\nWrote ${batchUpdates.length} cell updates to Inventory sheet.`);
  }

  // ── 6. Write audit entries ─────────────────────────────
  if (auditEntries.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "'Inventory Audit'!A:H",
      valueInputOption: 'RAW',
      requestBody: { values: auditEntries },
    });
    console.log(`Wrote ${auditEntries.length} reconciliation entries to Inventory Audit.`);
  }

  console.log('\n✅ Stock reconciliation complete.');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
