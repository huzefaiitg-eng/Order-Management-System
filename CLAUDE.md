# Bombay Stride — Order Management System (OMS)

## Overview
A web application for managing shoe orders coming from multiple sales channels (Amazon, Flipkart, Meesho, Instagram, WhatsApp). The app connects to a Google Sheet as the data source, provides a rich analytics dashboard, and allows order status updates from the UI.

**Brand:** Bombay Stride
**Business context:** High-quality shoes sold at affordable prices across marketplaces and social media channels.

## Theme
- **Primary:** Terracotta (#C8956C) — used for buttons, active states, badges, chart accents
- **Secondary:** Black (#101010) — navbar background
- **Tertiary:** White (#F6F6F6) — page background
- Custom Tailwind v4 colors defined via `@theme` in `client/src/index.css`
- Logo: `client/src/assets/logo.png`

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Node.js (Express)
- **Data Source:** Google Sheets API (via Service Account JSON credentials)
- **Charts:** Recharts (or similar lightweight React charting library)

## Google Sheet Schema

### Tab: `Orders`
| Column | Description |
|---|---|
| Order From | Sales channel: Amazon, Flipkart, Meesho, Instagram, WhatsApp |
| Order Date | Date the order was placed |
| Customer Name | Full name of the customer |
| Customer Phone Number | Contact number |
| Customer Address | Delivery address |
| Mode of Payment | COD, UPI, Bank Transfer, Credit/Debit Card, Wallet, EMI |
| Product Ordered | Shoe product name/SKU (links to Inventory master) |
| Product Cost | Cost price of the product |
| Quantity Ordered | Number of units ordered |
| Price Paid by Customer | Selling price / amount paid |
| Order Status | Current status of the order |

### Tab: `Customers`
| Column | Description |
|---|---|
| Customer ID | Unique customer identifier (e.g., CUST001) |
| Customer Name | Full name |
| Customer Phone | Contact number (primary key for linking) |
| Customer Address | Delivery address |
| Number of Orders | Total order count |
| Any Active Order | Whether customer has active orders (Yes/No) |
| Customer Email | Email address |
| Status | Active or Archived |

### Tab: `Inventory`
| Column | Description |
|---|---|
| Article ID | Unique product identifier (e.g., ART-001) |
| Product Name | Product name (links to Orders via Product Ordered) |
| Product Description | Detailed product description |
| Category | Men, Women, or Kids |
| Sub Category | Casual Wear, Office Wear, Party Wear, Sports, Ethnic, Daily Wear |
| Product Images | Product image URLs (comma-separated) |
| Product Cost | Cost price per unit |
| Instock Quantity | Current stock level |
| Quantity in Active Orders | Units committed to active orders |
| Status | Active or Archived |

### Order Statuses
`Pending` → `Confirmed` → `Packed` → `Shipped` → `Out for Delivery` → `Delivered`
Branch statuses: `Returned`, `Cancelled`, `Refunded`

## App Features

### 1. Dashboard (Home Page)
- **KPI Cards:** Total orders, total revenue, total profit, average order value, return rate
- **Charts:**
  - Orders by source (bar/pie chart)
  - Revenue over time (line chart)
  - Order status breakdown (donut chart)
  - Profit margin trends (line chart)
  - Payment mode distribution (pie chart)
- **Filters:** Date range, order source, status

### 2. Orders List Page
- Searchable, sortable, filterable table of all orders
- Filters: order source, status, payment mode, date range
- Inline status update (dropdown to change order status — writes back to Google Sheet)
- Profit column (Price Paid - Product Cost) with color coding (green for profit, red for loss)
- Orders enriched with customer data from Customers master and product data from Inventory master

### 3. Insights & Actions Panel (Tabbed)
**Order Insights:**
- COD payment follow-ups (delivered COD orders)
- Delayed order alerts (stuck in status > 3 days)
- Repeat customer patterns
- Low-margin alerts (< 10% margin)

**Customer Insights:**
- High-value customers (top 10 spenders)
- Churn risk (no order in 60+ days)
- Attention needed (customers with delayed orders)
- High return rate customers (> 30% return rate)

**Inventory Insights:**
- Low stock alerts (available qty < 5)
- Out of stock products
- Best selling products (top 10 by order count)
- Slow moving inventory (high stock, few orders)
- High return products (> 20% return rate)

### 4. Order Detail View
- Full details of a single order
- Product info enriched from Inventory (description, category, sub-category badges)
- Product name links to Inventory detail page
- Status timeline/history
- Customer order history (other orders from the same customer)

### 5. Inventory Page
- Summary cards: Total products (active only), inventory value, low stock count, out of stock count
- Searchable, filterable table (by category, sub-category) — shows Active products only
- Columns: Article ID, Product Name, Category, Sub Category, Cost, In Stock, Active Orders, Available (color-coded stock badge), Total Sold, Archive button
- Click "View" to open Product Detail page
- **Add Product** button — opens modal form to add a new product (auto-generates Article ID)
- **Archived** button — navigates to Archived Inventory page

### 6. Product Detail Page
- Product header with name, description, article ID, category/sub-category badges, stock badge
- **Edit** button to inline-edit: Product Name, Category, Sub Category, Cost, Instock Qty
- **Archive** button — marks product as Archived and navigates to inventory list
- Stats cards: Cost price, in stock, total orders, revenue, return rate
- Order history table for this product (date, customer, source, price, profit, status)

### 7. Customers Page
- Summary cards: Total customers, customers with active orders, repeat customers
- Searchable, sortable table showing:
  - Customer name (with avatar initials)
  - Phone number
  - Email address
  - Address
  - Number of orders done (total)
  - Active order count (orders in non-terminal status)
  - Archive button per row
- Click "View" to open Customer Detail page
- **Add Customer** button — opens modal form to add a new customer (auto-generates Customer ID)
- **Archived** button — navigates to Archived Customers page

### 8. Customer Detail Page
- Customer profile header with avatar, name, phone, email, address
- **Edit** button to inline-edit: Name, Phone, Email, Address
- **Archive** button — marks customer as Archived and navigates to customers list
- Stats cards: Total orders, active orders, total spent, average order value
- Active orders table with inline status update (writes back to Google Sheet)
- Order history table for completed/cancelled/returned orders

### 9. Archived Customers Page (`/customers/archived`)
- Lists all customers with Status = "Archived" from the Customers sheet
- Each row has **Unarchive** (restores to active) and **Delete** (permanently removes row from sheet) buttons
- Delete requires confirmation before removing

### 10. Archived Inventory Page (`/inventory/archived`)
- Lists all products with Status = "Archived" from the Inventory sheet
- Each row has **Unarchive** (restores to active) and **Delete** (permanently removes row from sheet) buttons
- Delete requires confirmation before removing

## Architecture

### Data Flow
- **Customers sheet** is the master for customer data (name, phone, address)
- **Inventory sheet** is the master for product data (name, description, category, cost, stock)
- **Orders sheet** references both masters via Customer Phone and Product Name
- Orders are enriched at API level with customer + inventory data on every request

### Frontend Structure
```
src/
  components/       # Reusable UI components (StatusBadge, StockBadge, KpiCard, etc.)
  pages/            # Dashboard, Orders, OrderDetail, Inventory, ProductDetail, Customers, CustomerDetail, Insights
  hooks/            # Custom hooks (useOrders, useDashboard, useCustomers, useInventory, useInsights)
  services/         # API client functions
  utils/            # Formatters, helpers
  App.jsx
  main.jsx
```

### Backend Structure
```
server/
  index.js          # Express server entry point
  routes/           # API route handlers (orders, dashboard, insights, customers, inventory)
  services/         # Google Sheets service layer
  config/           # Sheets config, env setup
  seed.js           # Seed script for Orders data
  seed-inventory.js # Seed script for Inventory data
  credentials.json  # Google Service Account key (gitignored)
```

### API Endpoints
- `GET /api/orders` — Fetch all orders enriched with customer + inventory data (supports filters)
- `PATCH /api/orders/:rowIndex` — Update order status
- `GET /api/dashboard` — Aggregated stats for dashboard
- `GET /api/insights` — All insights (order, customer, inventory)
- `GET /api/customers` — Customer list (supports `?search=`, `?status=Active|Archived`, default Active)
- `POST /api/customers` — Add a new customer (auto-generates Customer ID)
- `PATCH /api/customers/:phone/archive` — Archive a customer
- `PATCH /api/customers/:phone/unarchive` — Unarchive a customer
- `DELETE /api/customers/:phone` — Permanently delete a customer row from the sheet
- `GET /api/customers/:phone` — Single customer detail with full order history
- `PATCH /api/customers/:phone` — Update customer details (name, phone, address, email)
- `GET /api/inventory` — Product list (supports `?search=`, `?category=`, `?subCategory=`, `?status=Active|Archived`, default Active)
- `GET /api/inventory/summary` — Inventory KPI aggregates (active products only)
- `POST /api/inventory` — Add a new product (auto-generates Article ID)
- `PATCH /api/inventory/:articleId/archive` — Archive a product
- `PATCH /api/inventory/:articleId/unarchive` — Unarchive a product
- `DELETE /api/inventory/:articleId` — Permanently delete a product row from the sheet
- `GET /api/inventory/:articleId` — Single product detail with order history
- `PATCH /api/inventory/:articleId` — Update product details (name, category, sub-category, cost, instock qty)

## Authentication
- Google Sheets API accessed via **Service Account** (JSON key file stored on backend)
- The Google Sheet must be shared with the service account email address
- No user-facing authentication required for v1

## Environment Variables
```
GOOGLE_SHEET_ID=<spreadsheet-id>
GOOGLE_CREDENTIALS_PATH=./credentials.json    # Local dev (file-based)
GOOGLE_CREDENTIALS=<json-string>              # Production (env var with full JSON)
PORT=3001
CLIENT_URL=<frontend-url>                     # CORS origin for production
VITE_API_URL=<backend-url>                    # Frontend env var for API base URL
```

## Deployment
- **Frontend:** Render Static Site (root: `client`, build: `npm install && npm run build`, publish: `dist`)
- **Backend:** Render Web Service (root: `server`, build: `npm install`, start: `node index.js`)
- Credentials loaded from `GOOGLE_CREDENTIALS` env var in production (JSON string)

## Development Commands
```bash
# Frontend
cd client && npm install && npm run dev

# Backend
cd server && npm install && npm run dev

# Seed data
cd server && node seed.js          # Seed 100 orders
cd server && node seed-inventory.js # Seed 20 products
```

## Conventions
- Use functional React components with hooks
- Tailwind CSS for all styling — no separate CSS files
- API responses follow `{ success: boolean, data: any, error?: string }` format
- Environment variables loaded via dotenv on backend
- All dates displayed in DD/MM/YYYY format (Indian locale)
- Currency displayed in INR (₹) format
- credentials.json must NEVER be committed to git
