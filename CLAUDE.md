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

### Tab: `Audit`
| Column | Description |
|---|---|
| Order Row Index | Row number of the order in Orders sheet |
| Previous Status | Status before the change (empty for initial creation) |
| New Status | Status after the change |
| Changed At | ISO 8601 timestamp of the change |

### Order Statuses
`Pending` → `Confirmed` → `Packed` → `Shipped` → `Out for Delivery` → `Delivered`
Branch statuses: `Returned`, `Cancelled`, `Refunded`

## App Features

### 1. Dashboard (Home Page)
**Layout (top → bottom):**
1. Orders KPI group (Total Orders, Revenue, Profit, Avg Order Value, Return Rate) — full width
2. Charts Row A — Orders by Source (bar) + Revenue & Profit Over Time (line)
3. Charts Row B — Order Status Breakdown (donut) + Payment Mode Distribution (pie)
4. Customers and Inventory summary group cards (unfiltered master-data counts)

**Per-card filters:** Each of the 5 order-related cards has its OWN independent filter button (icon + "Filters" text on desktop, icon-only on mobile) that opens a centered modal. Active filters are shown as removable chips in the card header. Filter controls use a two-tier pending/applied state — edits only commit when "Apply Filters" is clicked. Individual chips can be removed directly without reopening the modal.

**Filter dimensions per card:**
| Card | Time | Source | Customer | Product |
|---|:---:|:---:|:---:|:---:|
| Orders KPIs | ✓ | ✓ | ✓ | ✓ |
| Orders by Source | ✓ | ✗ (X-axis) | ✓ | ✓ |
| Revenue & Profit Over Time | ✓ | ✓ | ✓ | ✓ |
| Order Status Breakdown | ✓ | ✓ | ✓ | ✓ |
| Payment Mode Distribution | ✓ | ✓ | ✓ | ✓ |

**Time presets:** All Time, Today, Yesterday, Last 7 Days, Last 30 Days, Custom (date pickers).

**Multi-series Revenue & Profit chart:** When the user selects ≥2 values in exactly ONE dimension (source, customer, or product), the chart renders one line per selected entity — solid for revenue, dashed for profit, cycling through `CHART_COLORS`. If the user selects multiple values in ≥2 dimensions at once, the chart falls back to single-pair lines (a helper note inside the modal explains this). Max 5 entities (= 10 lines) — excess shows a "Showing first 5 of X selected" note.

**Chip color conventions:**
- Date range / source: terracotta
- Customer: blue
- Product/inventory: amber

**Customers and Inventory cards** remain unfiltered and always show all-time master-data counts.

**Architecture:** The dashboard fetches all orders + master-data summaries in a **single** `GET /api/dashboard` request on mount. Per-card filtering happens entirely client-side via `client/src/utils/dashboardAggregations.js`, so filter interactions are instant with no extra network round-trips. This avoids Render free-tier cold-start delays on every filter change.

### 2. Orders List Page
- Searchable, sortable, filterable table of all orders
- Filters: order source, status, payment mode, date range
- Inline status update (dropdown to change order status — writes back to Google Sheet)
- Profit column (Price Paid - Product Cost) with color coding (green for profit, red for loss)
- Orders enriched with customer data from Customers master and product data from Inventory master
- **Add Order** button — opens modal form to manually create an order:
  - Date (default today DD/MM/YYYY), Source (dropdown including "Manual"), Customer (searchable from active customers or add new inline), Product (searchable from active inventory or add new inline), Payment mode, Quantity, Price
  - Default status: Pending
  - Logs initial audit entry on creation

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
- **Audit History** section — shows chronological timeline of all status changes with timestamps, previous/new status, and "Order created" marker for initial entry
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
  components/       # Reusable UI components (StatusBadge, StockBadge, KpiCard, ProtectedRoute,
                    #   SearchableDropdown, TimePresetPicker, CardFilterModal, FilterableCard, BillModal, etc.)
  context/          # React contexts (AuthContext)
  pages/            # Dashboard, Orders, OrderDetail, Inventory, ProductDetail, Customers, CustomerDetail, Insights, Login, Profile
  hooks/            # Custom hooks (useOrders, useDashboard, useCustomers, useInventory, useInsights, useCardFilters)
  services/         # API client functions (includes auth: login, logout, fetchProfile, updateProfile)
  utils/            # Formatters, helpers, dashboardAggregations (client-side dashboard filtering/aggregation)
  App.jsx
  main.jsx
```

### Backend Structure
```
server/
  index.js          # Express server entry point (auth middleware gate)
  middleware/       # Auth middleware (JWT validation)
  routes/           # API route handlers (auth, orders, dashboard, insights, customers, inventory)
  services/         # Google Sheets service layer, User Access service
  config/           # Sheets config, env setup
  seed.js           # Seed script for Orders data
  seed-inventory.js # Seed script for Inventory data
  seed-users.js     # Seed script for demo user in User Access sheet
  credentials.json  # Google Service Account key (gitignored)
```

### API Endpoints
- `GET /api/orders` — Fetch all orders enriched with customer + inventory data (supports filters)
- `POST /api/orders` — Add a new order (auto-sets status to Pending, logs audit entry)
- `GET /api/orders/:rowIndex/audit` — Fetch audit history (status changes) for an order
- `PATCH /api/orders/:rowIndex` — Update order status (logs audit entry with previous/new status)
- `GET /api/dashboard` — Returns raw orders (trimmed) + customer/inventory summary KPIs. No query params; per-card filtering is client-side.
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

### Google Sheets API
- Accessed via **Service Account** (JSON key file stored on backend)
- The Google Sheet must be shared with the service account email address

### User Authentication (JWT)
- Users are stored in a separate **User Access Google Sheet** (configured via `USER_ACCESS_SHEET_ID`)
- Login validates email + password against the User Access sheet
- On success, a JWT token (7-day expiry) is issued containing `{ email, sheetId }`
- The `sheetId` is extracted from the user's "Order Sheet Link" column — each user has their own data sheet
- All protected API routes require `Authorization: Bearer <token>` header
- Auth middleware sets `req.user = { email, sheetId }` on every request
- Frontend stores token in `localStorage` as `oms_token`
- On 401 response, frontend clears token and redirects to `/login`

### User Access Google Sheet Schema
| Column | Description |
|---|---|
| Name | User's full name |
| Company Name | Business/company name |
| Email | Login email (case-insensitive) |
| Phone | Contact number |
| Address | Business address |
| Website | Business website |
| Password | Login password (plain text) |
| Order Sheet Link | Full Google Sheets URL for this user's order data |

### Auth API Endpoints
- `POST /api/auth/login` — Validate credentials, return JWT token + user profile (public)
- `GET /api/auth/profile` — Fetch current user profile (protected)
- `PATCH /api/auth/profile` — Update user profile: name, companyName, phone, address, website (protected)

### Auth Flow
1. User navigates to app → redirected to `/login` if no valid token
2. User enters email + password → `POST /api/auth/login` validates against User Access sheet
3. JWT issued with `{ email, sheetId }` → stored in localStorage
4. All subsequent API requests include `Authorization: Bearer <token>`
5. Backend extracts `sheetId` from token → queries the user's specific Google Sheet

### Frontend Auth Components
- `AuthContext` (`client/src/context/AuthContext.jsx`) — provides `user`, `loading`, `login()`, `logout()`, `updateUser()`
- `ProtectedRoute` (`client/src/components/ProtectedRoute.jsx`) — redirects to `/login` if unauthenticated
- `Login` page (`client/src/pages/Login.jsx`) — centered login form with logo
- `Profile` page (`client/src/pages/Profile.jsx`) — editable user info (email disabled)
- `Navbar` avatar — terracotta circle with user initials, dropdown with Profile + Logout

### Demo Account
- Email: `demo@kanchwalahozefa.com`
- Password: `demo@12345`
- Seed script: `cd server && node seed-users.js`

## Environment Variables
```
GOOGLE_SHEET_ID=<spreadsheet-id>
GOOGLE_CREDENTIALS_PATH=./credentials.json    # Local dev (file-based)
GOOGLE_CREDENTIALS=<json-string>              # Production (env var with full JSON)
PORT=3001
CLIENT_URL=<frontend-url>                     # CORS origin for production
VITE_API_URL=<backend-url>                    # Frontend env var for API base URL
USER_ACCESS_SHEET_ID=<user-access-sheet-id>   # Google Sheet ID for user credentials
JWT_SECRET=<jwt-secret>                       # Secret for signing JWT tokens
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
cd server && node seed-users.js    # Seed demo user in User Access sheet
```

## Conventions
- Use functional React components with hooks
- Tailwind CSS for all styling — no separate CSS files
- API responses follow `{ success: boolean, data: any, error?: string }` format
- Environment variables loaded via dotenv on backend
- All dates displayed in DD/MM/YYYY format (Indian locale)
- Currency displayed in INR (₹) format
- credentials.json must NEVER be committed to git
