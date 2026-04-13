/**
 * One-time migration script
 * ─────────────────────────
 * For every order in the demo sheet:
 *   1. Look up the product(s) in the Inventory tab → grab Selling Price
 *   2. Write that into column M (Selling Price) on the Orders tab
 *   3. Recalculate column J (Price Paid) = Σ(sellingPrice × qty)  (no discount)
 *   4. Clear column N (Discount)
 */

require('dotenv').config();
const { google } = require('googleapis');
const env = require('./config/env');

const SHEET_ID = '1p5IE2zLh0Z5uZjFlSGDiqUoGLcdxuolrt7w-Av_YcgE';

async function run() {
  /* ── Auth ────────────────────────────────────────────────── */
  const credentials = JSON.parse(
    process.env.GOOGLE_CREDENTIALS ||
      require('fs').readFileSync(env.GOOGLE_CREDENTIALS_PATH, 'utf8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  /* ── 1. Read Inventory → build productName → sellingPrice map ── */
  const invRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Inventory!A2:K',
  });
  const invRows = invRes.data.values || [];

  // Inventory columns: 0=articleId, 1=productName, 6=productCost, 7=sellingPrice
  const priceMap = {};          // productName (lowercase) → sellingPrice
  const costMap = {};            // productName (lowercase) → productCost (fallback)
  for (const row of invRows) {
    const name = (row[1] || '').trim().toLowerCase();
    if (!name) continue;
    priceMap[name] = parseFloat(row[7]) || 0;
    costMap[name]  = parseFloat(row[6]) || 0;
  }

  console.log(`Inventory loaded: ${Object.keys(priceMap).length} products`);
  console.log('Sample:', Object.entries(priceMap).slice(0, 5));

  /* ── 2. Read all Orders ─────────────────────────────────── */
  const ordRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Orders!A2:N',
  });
  const ordRows = ordRes.data.values || [];
  console.log(`Orders loaded: ${ordRows.length} rows`);

  // Orders columns:
  // 6=productOrdered  7=productCost  8=quantityOrdered
  // 9=pricePaid       12=sellingPrice  13=discount

  /* ── 3. Build batch updates ─────────────────────────────── */
  const batchData = [];
  let updated = 0;
  let notFound = [];

  for (let i = 0; i < ordRows.length; i++) {
    const row = ordRows[i];
    const sheetRow = i + 2; // header is row 1

    const products = (row[6] || '').split('|').map(s => s.trim()).filter(Boolean);
    const quantities = (row[8] || '1').split('|').map(s => parseInt(s.trim()) || 1);

    if (products.length === 0) continue;

    // Look up selling prices from inventory
    const sellingPrices = products.map((pName, idx) => {
      const key = pName.toLowerCase();
      if (priceMap[key] && priceMap[key] > 0) return priceMap[key];
      // Fallback to cost if selling price is 0 or missing
      if (costMap[key]) return costMap[key];
      notFound.push(pName);
      return 0;
    });

    // Build pipe-separated selling price string
    const sellingPriceStr = sellingPrices.join(' | ');

    // Calculate Price Paid = sum(sellingPrice × qty), discount = 0
    const pricePaid = sellingPrices.reduce((sum, sp, idx) => {
      return sum + sp * (quantities[idx] || 1);
    }, 0);

    // Column M = sellingPrice (col index 13 → letter M)
    batchData.push({
      range: `Orders!M${sheetRow}`,
      values: [[sellingPriceStr]],
    });

    // Column J = pricePaid (col index 10 → letter J)
    batchData.push({
      range: `Orders!J${sheetRow}`,
      values: [[pricePaid.toString()]],
    });

    // Column N = discount (clear it)
    batchData.push({
      range: `Orders!N${sheetRow}`,
      values: [['']],
    });

    updated++;
  }

  if (notFound.length > 0) {
    const unique = [...new Set(notFound)];
    console.warn(`\n⚠  Products not found in inventory (${unique.length}):`);
    unique.forEach(n => console.warn(`   - ${n}`));
  }

  /* ── 4. Write batch ─────────────────────────────────────── */
  if (batchData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: batchData,
      },
    });
    console.log(`\n✅ Updated ${updated} orders (${batchData.length} cells written)`);
  } else {
    console.log('No orders to update.');
  }

  /* ── 5. Verify: re-read first 5 rows to confirm ────────── */
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Orders!G2:N6',
  });
  console.log('\nVerification (first 5 orders — cols G through N):');
  (verify.data.values || []).forEach((r, i) => {
    console.log(`  Row ${i + 2}: product="${r[0]}" cost=${r[1]} qty=${r[2]} pricePaid=${r[3]} status=${r[4]} orderNum=${r[5]} sellingPrice=${r[6]} discount=${r[7] || '(empty)'}`);
  });
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
