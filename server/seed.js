const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const SOURCES = ['Amazon', 'Flipkart', 'Meesho', 'Instagram', 'WhatsApp'];
const PAYMENTS = ['COD', 'UPI', 'Bank Transfer', 'Credit/Debit Card', 'Wallet', 'EMI'];
const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled', 'Refunded'];
const PRODUCTS = [
  'Classic Leather Loafers', 'Running Sneakers Pro', 'Casual Canvas Slip-On', 'Formal Oxford Black',
  'Sports Training Shoes', 'Suede Chelsea Boots', 'Lightweight Joggers', 'Premium Brogue Tan',
  'High-Top Basketball Shoes', 'Mesh Walking Shoes', 'Sandal Comfort Plus', 'Flip Flop Daily',
  'Hiking Trail Boots', 'Office Derby Brown', 'Ethnic Mojari Gold', 'Kids Velcro Sneakers',
  'Women Stiletto Heels', 'Flat Ballerina Pink', 'Ankle Boot Zipper', 'Kolhapuri Chappal',
];
const FIRST_NAMES = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rajesh', 'Pooja', 'Suresh', 'Neha',
  'Arjun', 'Kavita', 'Deepak', 'Meera', 'Rohit', 'Swati', 'Manish', 'Divya', 'Sanjay', 'Ritu',
  'Arun', 'Nisha', 'Gaurav', 'Anita', 'Vivek', 'Sunita', 'Karan', 'Rekha', 'Nikhil', 'Pallavi'];
const LAST_NAMES = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Joshi', 'Reddy', 'Nair', 'Mehta',
  'Rao', 'Desai', 'Iyer', 'Khan', 'Mishra', 'Chopra', 'Bhat', 'Pillai', 'Agarwal', 'Das'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Surat', 'Nagpur', 'Indore', 'Bhopal', 'Chandigarh'];
const AREAS = ['MG Road', 'Sector 15', 'Koramangala', 'Banjara Hills', 'T Nagar', 'Kothrud', 'Salt Lake', 'CG Road',
  'MI Road', 'Hazratganj', 'Ring Road', 'Civil Lines', 'Vijay Nagar', 'New Market', 'Phase 7'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randPhone() { return `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}`; }

function randDate() {
  const start = new Date(2025, 0, 1);
  const end = new Date(2026, 2, 26);
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function generateOrders(count) {
  const rows = [];
  // Create some repeat customers
  const repeatCustomers = Array.from({ length: 10 }, () => ({
    name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
    phone: randPhone(),
    address: `${randInt(1, 500)}, ${rand(AREAS)}, ${rand(CITIES)} - ${randInt(100000, 999999)}`,
  }));

  for (let i = 0; i < count; i++) {
    const isRepeat = Math.random() < 0.3;
    const customer = isRepeat ? rand(repeatCustomers) : {
      name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
      phone: randPhone(),
      address: `${randInt(1, 500)}, ${rand(AREAS)}, ${rand(CITIES)} - ${randInt(100000, 999999)}`,
    };

    const productCost = randInt(400, 2500);
    const markup = 1 + (Math.random() * 0.6 + 0.05); // 5% to 65% markup
    const pricePaid = Math.round(productCost * markup);
    // Some low-margin or loss orders
    const finalPrice = Math.random() < 0.08 ? productCost - randInt(50, 200) : pricePaid;

    rows.push([
      rand(SOURCES),
      randDate(),
      customer.name,
      customer.phone,
      customer.address,
      rand(PAYMENTS),
      rand(PRODUCTS),
      productCost.toString(),
      finalPrice.toString(),
      rand(STATUSES),
    ]);
  }
  return rows;
}

async function seed() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Write headers
  const headers = [
    ['Order From', 'Order Date', 'Customer Name', 'Customer Phone Number',
     'Customer Address', 'Mode of Payment', 'Product Ordered',
     'Product Cost', 'Price Paid by Customer', 'Order Status']
  ];

  const orders = generateOrders(100);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Orders!A1:J1',
    valueInputOption: 'RAW',
    requestBody: { values: headers },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Orders!A2:J101',
    valueInputOption: 'RAW',
    requestBody: { values: orders },
  });

  console.log('Seeded 100 orders successfully!');
}

seed().catch(console.error);
