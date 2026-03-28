const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const PRODUCTS = [
  { name: 'Classic Leather Loafers', desc: 'Premium genuine leather loafers with cushioned insole for all-day comfort', category: 'Men', subCategory: 'Office Wear', cost: 1200 },
  { name: 'Running Sneakers Pro', desc: 'Lightweight breathable mesh sneakers with shock-absorbing sole for running', category: 'Men', subCategory: 'Sports', cost: 1800 },
  { name: 'Casual Canvas Slip-On', desc: 'Soft canvas slip-on shoes perfect for casual outings and daily wear', category: 'Men', subCategory: 'Casual Wear', cost: 600 },
  { name: 'Formal Oxford Black', desc: 'Classic black Oxford shoes with polished leather finish for formal occasions', category: 'Men', subCategory: 'Office Wear', cost: 1500 },
  { name: 'Sports Training Shoes', desc: 'Multi-sport training shoes with enhanced grip and ankle support', category: 'Men', subCategory: 'Sports', cost: 1400 },
  { name: 'Suede Chelsea Boots', desc: 'Stylish suede Chelsea boots with elastic side panel and block heel', category: 'Men', subCategory: 'Party Wear', cost: 2000 },
  { name: 'Lightweight Joggers', desc: 'Ultra-light jogger shoes with flexible sole for walking and light exercise', category: 'Men', subCategory: 'Casual Wear', cost: 900 },
  { name: 'Premium Brogue Tan', desc: 'Hand-stitched tan brogue shoes with perforated detailing', category: 'Men', subCategory: 'Office Wear', cost: 1700 },
  { name: 'High-Top Basketball Shoes', desc: 'High-top sneakers with ankle support designed for basketball and court sports', category: 'Men', subCategory: 'Sports', cost: 2200 },
  { name: 'Mesh Walking Shoes', desc: 'Breathable mesh walking shoes with memory foam insole', category: 'Men', subCategory: 'Casual Wear', cost: 800 },
  { name: 'Sandal Comfort Plus', desc: 'Ergonomic comfort sandals with arch support and soft straps', category: 'Men', subCategory: 'Daily Wear', cost: 500 },
  { name: 'Flip Flop Daily', desc: 'Durable rubber flip flops for everyday home and outdoor use', category: 'Men', subCategory: 'Daily Wear', cost: 250 },
  { name: 'Hiking Trail Boots', desc: 'Waterproof trail boots with rugged sole for trekking and hiking', category: 'Men', subCategory: 'Sports', cost: 2400 },
  { name: 'Office Derby Brown', desc: 'Brown Derby shoes with open lacing for a smart office look', category: 'Men', subCategory: 'Office Wear', cost: 1300 },
  { name: 'Ethnic Mojari Gold', desc: 'Traditional gold-embroidered Mojari shoes for festive and ethnic occasions', category: 'Men', subCategory: 'Ethnic', cost: 800 },
  { name: 'Kids Velcro Sneakers', desc: 'Colorful velcro-strap sneakers for kids with non-slip sole', category: 'Kids', subCategory: 'Casual Wear', cost: 450 },
  { name: 'Women Stiletto Heels', desc: 'Elegant stiletto heels with pointed toe for parties and formal events', category: 'Women', subCategory: 'Party Wear', cost: 1600 },
  { name: 'Flat Ballerina Pink', desc: 'Soft pink ballerina flats with bow detail for casual and semi-formal wear', category: 'Women', subCategory: 'Casual Wear', cost: 700 },
  { name: 'Ankle Boot Zipper', desc: 'Sleek ankle boots with side zipper and low block heel', category: 'Women', subCategory: 'Party Wear', cost: 1800 },
  { name: 'Kolhapuri Chappal', desc: 'Handcrafted Kolhapuri leather chappals with traditional design', category: 'Men', subCategory: 'Ethnic', cost: 600 },
];

async function seed() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Read existing orders to compute active order quantities per product
  const ordersRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Orders!A2:J',
  });
  const orders = ordersRes.data.values || [];
  const activeStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];

  const activeOrderQty = {};
  orders.forEach(row => {
    const product = row[6] || '';
    const status = row[9] || '';
    if (activeStatuses.includes(status)) {
      activeOrderQty[product] = (activeOrderQty[product] || 0) + 1;
    }
  });

  const rows = PRODUCTS.map((p, i) => {
    const articleId = `ART-${String(i + 1).padStart(3, '0')}`;
    const instock = Math.floor(Math.random() * 45) + 5; // 5-50
    const activeQty = activeOrderQty[p.name] || 0;
    return [
      articleId,
      p.name,
      p.desc,
      p.category,
      p.subCategory,
      '', // Product Images (empty for now)
      p.cost.toString(),
      instock.toString(),
      activeQty.toString(),
    ];
  });

  // Also add 2 out-of-stock products for testing insights
  rows[3][7] = '0'; // Formal Oxford Black - out of stock
  rows[11][7] = '0'; // Flip Flop Daily - out of stock
  // And 2 low-stock products
  rows[14][7] = '3'; // Ethnic Mojari Gold - low stock
  rows[15][7] = '2'; // Kids Velcro Sneakers - low stock

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Inventory!A2:I',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  console.log(`Seeded ${rows.length} products in Inventory sheet`);
}

seed().catch(console.error);
