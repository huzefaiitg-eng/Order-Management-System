/**
 * seed-leads.js
 * Seed ~500 dummy leads into the Leads tab.
 *
 * ~70 are "Converted" and correlated to real orders already in the Orders sheet.
 * The remaining ~430 are distributed across all statuses with realistic
 * follow-up dates, budgets, sources, and notes.
 *
 * Usage:
 *   cd server && node seed-leads.js
 *
 * The script reads GOOGLE_SHEET_ID from your .env file.
 * It will CLEAR the existing Leads tab content before writing.
 */

const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// ── Reference data ─────────────────────────────────────────────

const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];
const SOURCE_WEIGHTS = [0.38, 0.25, 0.15, 0.12, 0.10]; // cumulative later

const LEAD_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];

const PRODUCTS = [
  'Classic Leather Loafers', 'Running Sneakers Pro', 'Casual Canvas Slip-On', 'Formal Oxford Black',
  'Sports Training Shoes', 'Suede Chelsea Boots', 'Lightweight Joggers', 'Premium Brogue Tan',
  'High-Top Basketball Shoes', 'Mesh Walking Shoes', 'Sandal Comfort Plus', 'Flip Flop Daily',
  'Hiking Trail Boots', 'Office Derby Brown', 'Ethnic Mojari Gold', 'Kids Velcro Sneakers',
  'Women Stiletto Heels', 'Flat Ballerina Pink', 'Ankle Boot Zipper', 'Kolhapuri Chappal',
];

const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rajesh', 'Pooja', 'Suresh', 'Neha',
  'Arjun', 'Kavita', 'Deepak', 'Meera', 'Rohit', 'Swati', 'Manish', 'Divya', 'Sanjay', 'Ritu',
  'Arun', 'Nisha', 'Gaurav', 'Anita', 'Vivek', 'Sunita', 'Karan', 'Rekha', 'Nikhil', 'Pallavi',
  'Harsh', 'Shreya', 'Pankaj', 'Aarti', 'Varun', 'Shweta', 'Mohit', 'Tanvi', 'Kunal', 'Jyoti',
];
const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Joshi', 'Reddy', 'Nair', 'Mehta',
  'Rao', 'Desai', 'Iyer', 'Khan', 'Mishra', 'Chopra', 'Bhat', 'Pillai', 'Agarwal', 'Das',
];

const NOTES_BANK = [
  'Customer asked for more details on sizing.',
  'Interested in bulk purchase for family.',
  'Wants to check availability in stores first.',
  'Following up via WhatsApp — very responsive.',
  'Requested images of the sole and insole.',
  'Said will confirm after discussing with spouse.',
  'Asked about return policy before committing.',
  'Very interested — needs delivery by next week.',
  'Comparing with a competitor product.',
  'Wanted to know if customisation is possible.',
  'Budget is tight — asked for best offer.',
  'First-time customer, needs some convincing.',
  'Repeat buyer, familiar with our quality.',
  'Referred by Priya Sharma.',
  'Enquired about exchange offer for old shoes.',
  'Wants a pair in a different colour.',
  'Saw the ad on Instagram and reached out.',
  'Said will place order after Diwali.',
  'Interested in 2 pairs — one for self, one as gift.',
  'Asked for invoice on company name.',
  '',
  '',
  '', // ~15% have no notes
];

// ── Helpers ────────────────────────────────────────────────────

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randPhone() { return `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`; }
function randName() { return `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`; }

/** Pick a source using weighted distribution */
function randSource() {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < LEAD_SOURCES.length; i++) {
    cum += SOURCE_WEIGHTS[i];
    if (r < cum) return LEAD_SOURCES[i];
  }
  return LEAD_SOURCES[LEAD_SOURCES.length - 1];
}

/** Format a Date to DD/MM/YYYY */
function fmt(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Parse DD/MM/YYYY → Date */
function parseDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

/** Return a random date between start and end */
function randDateBetween(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/** Return a future follow-up date (1–21 days from now) */
function futureFollowUp() {
  const d = new Date();
  d.setDate(d.getDate() + randInt(1, 21));
  return fmt(d);
}

/** Return a past follow-up date (2–60 days ago) */
function pastFollowUp() {
  const d = new Date();
  d.setDate(d.getDate() - randInt(2, 60));
  return fmt(d);
}

/** Return a random budget in realistic buckets */
function randBudget(orderPrice) {
  if (orderPrice) {
    // For converted leads, budget ≈ order price ± small variation
    const delta = randInt(-200, 300);
    return Math.max(300, orderPrice + delta);
  }
  const buckets = [0, 0, 500, 700, 900, 1200, 1500, 2000, 2500, 3500, 5000];
  return rand(buckets);
}

/** Pick 1–3 products, return comma-separated string */
function randProducts(fixed) {
  if (fixed) return fixed;
  const count = Math.random() < 0.7 ? 1 : Math.random() < 0.6 ? 2 : 3;
  const shuffled = [...PRODUCTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(',');
}

// ── Main seed logic ────────────────────────────────────────────

async function seed() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // ── Step 1: Read existing orders ─────────────────────────────
  console.log('Reading existing orders...');
  let existingOrders = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A2:N',
    });
    existingOrders = (res.data.values || []).map((row, i) => ({
      rowIndex: i + 2,
      orderFrom: row[0] || '',
      orderDate: row[1] || '',
      customerName: row[2] || '',
      customerPhone: row[3] || '',
      productOrdered: row[6] || '',
      pricePaid: parseFloat(row[9]) || 0,
    })).filter(o => o.customerName && o.customerPhone && o.orderDate);
  } catch (err) {
    console.warn('Could not read orders (sheet may not exist):', err.message);
  }
  console.log(`Found ${existingOrders.length} existing orders.`);

  // ── Step 2: Ensure Leads tab exists with header ───────────────
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const allSheets = spreadsheet.data.sheets.map(s => s.properties.title);

  let leadsTabId = null;
  if (!allSheets.includes('Leads')) {
    console.log('Creating Leads tab...');
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'Leads' } } }],
      },
    });
    leadsTabId = addRes.data.replies[0].addSheet.properties.sheetId;
  } else {
    leadsTabId = spreadsheet.data.sheets.find(s => s.properties.title === 'Leads').properties.sheetId;
    // Clear existing data (keep header)
    console.log('Clearing existing Leads data...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Leads!A2:M',
    });
  }

  // Write header
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Leads!A1:M1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Lead ID', 'Lead Date', 'Customer Name', 'Customer Phone', 'Customer Email',
        'Products Interested', 'Lead Status', 'Lead Source', 'Follow-up Date',
        'Budget', 'Notes', 'Converted Order Row', 'Created At']],
    },
  });

  // ── Step 3: Build leads data ───────────────────────────────────

  const rows = [];
  let leadNum = 1;
  function nextId() { return `LEAD-${String(leadNum++).padStart(3, '0')}`; }

  const now = new Date();
  // Date range for historic data: last ~16 months
  const historyStart = new Date(now);
  historyStart.setMonth(historyStart.getMonth() - 16);

  // ── 3a. Converted leads from real orders ──────────────────────
  // Pick up to 70 orders to back-fill with a converted lead
  const convertCandidates = existingOrders
    .filter(o => o.orderDate && parseDate(o.orderDate)) // valid dates only
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(70, existingOrders.length));

  console.log(`Creating ${convertCandidates.length} converted leads from existing orders...`);

  for (const order of convertCandidates) {
    const orderDateObj = parseDate(order.orderDate);
    if (!orderDateObj) continue;

    // Lead was created 5–30 days before the order date
    const daysBeforeOrder = randInt(5, 30);
    const leadDateObj = new Date(orderDateObj);
    leadDateObj.setDate(leadDateObj.getDate() - daysBeforeOrder);

    // Clamp to history start
    if (leadDateObj < historyStart) leadDateObj.setTime(historyStart.getTime());

    // Map order source to a plausible lead source
    const sourceMap = {
      Instagram: 'Instagram', WhatsApp: 'WhatsApp',
      Amazon: 'Facebook', Flipkart: 'Referral', Meesho: 'Walk-in/Offline',
      Manual: 'Referral',
    };
    const src = sourceMap[order.orderFrom] || randSource();

    const budget = randBudget(order.pricePaid);
    const note = rand(NOTES_BANK) || `Placed order on ${order.orderDate}`;

    rows.push([
      nextId(),
      fmt(leadDateObj),
      order.customerName,
      order.customerPhone,
      '', // email
      order.productOrdered || rand(PRODUCTS),
      'Converted',
      src,
      '', // no follow-up date for converted
      String(budget),
      note,
      String(order.rowIndex), // link to order row
      leadDateObj.toISOString(),
    ]);
  }

  // ── 3b. Non-converted leads ───────────────────────────────────
  // Distribution: New Lead 90, Contacted 80, Interested 70, Follow-up 100, Lost 90 = 430
  const openLeadsConfig = [
    { status: 'New Lead',   count: 90 },
    { status: 'Contacted',  count: 80 },
    { status: 'Interested', count: 70 },
    { status: 'Follow-up',  count: 100 },
    { status: 'Lost',       count: 90 },
  ];

  for (const { status, count } of openLeadsConfig) {
    console.log(`Generating ${count} "${status}" leads...`);
    for (let i = 0; i < count; i++) {
      const leadDateObj = randDateBetween(historyStart, now);
      const src = randSource();
      const budget = randBudget(null);
      const note = rand(NOTES_BANK);
      const products = randProducts(null);

      // Follow-up date logic
      let followUpDate = '';
      if (status === 'Follow-up') {
        // 60% future, 40% past (overdue)
        followUpDate = Math.random() < 0.6 ? futureFollowUp() : pastFollowUp();
      } else if (status === 'Contacted' && Math.random() < 0.25) {
        followUpDate = Math.random() < 0.5 ? futureFollowUp() : pastFollowUp();
      } else if (status === 'Interested' && Math.random() < 0.35) {
        followUpDate = futureFollowUp();
      } else if (status === 'New Lead' && Math.random() < 0.15) {
        followUpDate = futureFollowUp();
      }

      // Some leads have emails
      const email = Math.random() < 0.3
        ? `${rand(FIRST_NAMES).toLowerCase()}${randInt(10, 99)}@gmail.com`
        : '';

      rows.push([
        nextId(),
        fmt(leadDateObj),
        randName(),
        randPhone(),
        email,
        products,
        status,
        src,
        followUpDate,
        budget ? String(budget) : '',
        note,
        '', // no converted order row
        leadDateObj.toISOString(),
      ]);
    }
  }

  // ── Step 4: Shuffle to mix statuses naturally ─────────────────
  // Keep converted leads in their real order but shuffle the rest
  const converted = rows.filter(r => r[6] === 'Converted');
  const open = rows.filter(r => r[6] !== 'Converted').sort(() => Math.random() - 0.5);

  // Interleave: place converted leads scattered through the open leads
  const allRows = [];
  const totalOpen = open.length;
  const step = Math.floor(totalOpen / (converted.length + 1));
  let ci = 0;
  for (let i = 0; i < totalOpen; i++) {
    if (ci < converted.length && (i % step === 0 || i === Math.floor(totalOpen / 2))) {
      allRows.push(converted[ci++]);
    }
    allRows.push(open[i]);
  }
  // Append any remaining converted leads
  while (ci < converted.length) allRows.push(converted[ci++]);

  // Re-assign Lead IDs in final order
  for (let i = 0; i < allRows.length; i++) {
    allRows[i][0] = `LEAD-${String(i + 1).padStart(3, '0')}`;
  }

  // ── Step 5: Write to sheet ─────────────────────────────────────
  console.log(`Writing ${allRows.length} leads to Leads tab...`);

  // Write in batches of 200 to avoid API limits
  const BATCH = 200;
  for (let start = 0; start < allRows.length; start += BATCH) {
    const batch = allRows.slice(start, start + BATCH);
    const startRow = start + 2; // +2 for header and 1-based
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Leads!A${startRow}:M${startRow + batch.length - 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: batch },
    });
    console.log(`  Wrote rows ${startRow} – ${startRow + batch.length - 1}`);
  }

  // Status summary
  const summary = {};
  allRows.forEach(r => { summary[r[6]] = (summary[r[6]] || 0) + 1; });
  console.log('\n✓ Seed complete!');
  console.log(`Total leads: ${allRows.length}`);
  Object.entries(summary).sort(([a], [b]) => LEAD_STATUSES.indexOf(a) - LEAD_STATUSES.indexOf(b))
    .forEach(([status, count]) => console.log(`  ${status.padEnd(12)}: ${count}`));
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
