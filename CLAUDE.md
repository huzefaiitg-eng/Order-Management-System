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
| Product Ordered | Pipe-separated product names per line item (links to Inventory master when an Article ID is present in the corresponding column Q slot) |
| Product Cost | Pipe-separated cost prices per line item |
| Quantity Ordered | Pipe-separated quantities per line item |
| Price Paid by Customer | Total price paid (sum across all lines minus discount) |
| Order Status | Current status of the order |
| Article IDs (col Q) | Pipe-separated article IDs aligned 1:1 with Product Ordered. Empty slot = custom (non-inventory) line item — no stock decrement on delivery, no inventory enrichment on read. |

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

### Tab: `Leads`
| Column | Description |
|---|---|
| Lead ID | Auto-generated unique ID (e.g., LEAD-001) |
| Lead Date | Date the lead was created (DD/MM/YYYY) |
| Customer Name | Full name of the potential customer |
| Customer Phone | Contact number — used to link/create a Customer record |
| Customer Email | Optional email address |
| Products Interested | JSON array `[{productName, productCost, sellingPrice, quantity, articleId}, ...]`. Legacy comma-separated names auto-parsed on read for backward compat. `articleId` empty = custom (non-inventory) item; otherwise links to an Inventory product. |
| Lead Status | New Lead / Contacted / Interested / Follow-up / Converted / Lost |
| Lead Source | WhatsApp / Instagram / Facebook / Referral / Walk-in/Offline |
| Follow-up Date | Optional scheduled follow-up date (DD/MM/YYYY) |
| Budget | Expected order value (₹) |
| Notes | Free-text conversation history and preferences |
| Converted Order Row | Row index of the linked OMS order (set on conversion) |
| Created At | ISO 8601 creation timestamp |

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
- **Add Order** button — navigates to the dedicated full-page route `/orders/new`:
  - Date (default today DD/MM/YYYY), Source (dropdown including "Manual"), Customer (searchable from active customers or add new inline), Payment mode, Discount (order-level)
  - Each product line uses the shared `<ProductLineEditor />` component which supports two modes per line:
    - **From Inventory** — searchable picker; cost / selling price auto-fill from the chosen product, `articleId` recorded on the line
    - **Custom** — free-form Product Name + Cost + Selling Price (no inventory link, no stock decrement on delivery, profit still computed per line)
  - Multiple lines per order; each line has its own type. The toggle is hidden for users without Inventory Access — they can only add Custom lines.
  - Default status: Pending; logs initial audit entry on creation.

### 3. Insights (embedded in each page — no standalone Insights page)

Each of Orders, Customers, and Inventory has **two tabs**: **Insights** (default when navigating from Navbar) and the list/detail view. Dashboard links explicitly append `?tab=details` to land on the list view.

**Order Insights tab** (4 sections):
- COD payment follow-ups (delivered COD orders)
- Delayed order alerts (stuck in status > 3 days)
- Repeat customer patterns
- Low-margin alerts (< 10% margin)

**Customer Insights tab** (3 KPI cards + 4 sections):
- High-value customers (top 10 spenders)
- Churn risk (no order in 60+ days)
- Attention needed (customers with delayed orders)
- High return rate customers (> 30% return rate)

**Inventory Insights tab** (4 KPI cards + 5 sections):
- **Stock Alerts** (unified card) — out-of-stock products first, then low-stock (below minStock). Products that are also top-10 sellers get an amber ⭐ Top Seller pill inline. This replaces the former "Out of Stock", "Low Stock Alerts", and "Top Sellers at Risk" separate cards.
- **Max Stock Alerts** — products exceeding their maxStock cap (shows current / max + excess)
- **Slow Moving Inventory** — 10+ units in stock AND fewer than 2 total orders; sorted by stock descending
- **High Return Products** — products with ≥ 2 orders and > 20% return rate
- **Best Selling Products** — top 10 by order count; shows rank, orders, revenue

### 4. Order Detail View
- Full details of a single order
- Product info enriched from Inventory (description, category, sub-category badges)
- Product name links to Inventory detail page
- Status timeline/history
- **Audit History** section — shows chronological timeline of all status changes with timestamps, previous/new status, and "Order created" marker for initial entry
- Customer order history (other orders from the same customer)

### 5. Inventory Page
> **Optional module**: gated by the `Inventory Access` column in the User Access sheet. Users without `Yes` access see a marketing/upsell page (`InventoryUpsell.jsx`) at every `/inventory*` route — explaining what the module does, listing key features (stock alerts, KPIs, audit trail, etc.), with a `mailto:huzefa.iitg@gmail.com` CTA for requesting access. Backend returns 403 on `/api/inventory/*` for users without access (defense-in-depth).

Two tabs — **Insights** (default) and **All Products**:
- **Insights tab**: 4 KPI summary cards (Total Products, Inventory Value, Low Stock, Out of Stock — last two clickable, link to filtered All Products view) + 5 insight sections (see §3)
- **All Products tab**: searchable, filterable product card grid (by category, sub-category) — Active products only; sort dropdown (Name A–Z, Low/More stock first, Price, Most sold); lazy loading (25 per batch). If navigated from Dashboard with `?stockFilter=lowStock|outOfStock`, forces this tab and shows a filter badge.
- Each product card shows: image, name, article ID, category, selling price, cost, available qty, active orders, total sold; Archive button on hover.
- **Add Product** button — opens modal form (name, category, sub-category, cost, selling price, instock qty, min stock, max stock, description, images)
- **Archived** button — navigates to Archived Inventory page
- Product images uploaded via Cloudinary (`POST /api/upload`); stored per user in `oms-products/{sanitized-email}/`

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
- **Mobile responsive**: Filter flap with active-orders toggle and total-orders buckets (1, 2, 3, 4, 5, 5+) beside search, mobile-only sort dropdown (Total Orders high→low, Name A–Z, Name Z–A), lazy loading (25 per batch), minimal mobile card layout with avatar + name + phone + active badge + email/address + total-orders footer.

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
  pages/            # Dashboard, Orders, OrderDetail, Inventory, ProductDetail, Customers, CustomerDetail, Login, Profile
  hooks/            # Custom hooks (useOrders, useDashboard, useCustomers, useInventory, useOrderInsights, useCustomerInsights, useInventoryInsights, useCardFilters)
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
- `GET /api/insights?scope=orders|customers|inventory` — Scoped insights; returns only the relevant subset to reduce payload
- `POST /api/upload` — Upload image to Cloudinary; stores in `oms-products/{sanitized-email}/` per user (req.user.email decoded from JWT)
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
- `GET /api/leads` — All leads (supports `?status=`, `?source=`, `?search=`)
- `POST /api/leads` — Create lead + auto-create/link customer in Customers sheet
- `GET /api/leads/:leadId` — Single lead detail
- `PATCH /api/leads/:leadId` — Update lead fields or status
- `DELETE /api/leads/:leadId` — Delete lead

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
| Inventory Access | `Yes` enables the Inventory module for this user; `No` or blank disables. Hard-blocked at the API level (`/api/inventory/*` returns 403) and at the route level (frontend renders an upsell/marketing page). Admin-controlled — users cannot self-toggle. |

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

---

## 11. Lead Management (CRM)

### Overview
A second product module for tracking potential customers from first contact through conversion. The persona is the same as OMS — small retail shoe-business owners. The moat is simplicity + future WhatsApp automation. Phase 1 is fully manual lead tracking stored in a `Leads` tab in each user's existing Google Sheet.

### Product Switcher
The Navbar logo (top-left) is now a clickable product-switcher button (logo + ChevronDown). Clicking it opens a popover with two module tiles:
- 📦 **Order Management** → `/dashboard`
- 🎯 **Lead Management** → `/leads`

When in CRM mode (pathname starts with `/leads`), the Navbar shows only a **Leads** nav item. OMS nav items (Dashboard, Orders, Inventory, Customers) are hidden. Switching back to OMS restores the full nav.

### Lead Status Flow
`New Lead` → `Contacted` → `Interested` → `Follow-up` → `Converted` / `Lost`

Status badge colours (Tailwind):
| Status | Classes |
|---|---|
| New Lead | `bg-slate-100 text-slate-700` |
| Contacted | `bg-blue-100 text-blue-700` |
| Interested | `bg-indigo-100 text-indigo-700` |
| Follow-up | `bg-amber-100 text-amber-700` |
| Converted | `bg-green-100 text-green-700` |
| Lost | `bg-red-100 text-red-700` |

### Lead Sources
WhatsApp · Instagram · Facebook · Referral · Walk-in/Offline

### Key Behaviours
- **Auto-create customer**: When a lead is saved, the API checks if a Customer with the same phone number exists. If not, a new Customer record is created automatically in the Customers sheet.
- **Multi-product interest with financials**: Stored as a JSON array in column F: `[{productName, productCost, sellingPrice, quantity, articleId}, ...]`. Each line carries its own cost, selling price, and quantity. `articleId` empty = custom (non-inventory) line; otherwise links to an Inventory product. Legacy comma-separated names are auto-parsed on read for backward compatibility.
- **Conversion flow**: When a lead status is set to Converted, a "Create Order" button appears in LeadDetail. Clicking it navigates to `/orders/new` and forwards the full `productLines` array (with cost/price/qty/articleId per line) and customer info via `location.state.prefill`. AddOrder reads the prefill on mount and pre-populates every field.
- **Linked order**: After creating the order, the `convertedOrderRow` field on the lead can be updated (via PATCH) to link back to the OMS order row index.
- **Kanban board**: The List tab has a Table/Kanban toggle. Dragging a card between columns fires a PATCH to update lead status. HTML5 Drag and Drop API — no external library.
- **Follow-up overdue highlight**: If `followUpDate` (DD/MM/YYYY) is before today, the date is shown in red.

### Pages

#### Leads page (`/leads`)
- `?tab=insights` (default): 4 KPI cards (Total Leads, Conversion Rate, Pipeline Value, Follow-ups Due Today) + pipeline funnel chart (horizontal BarChart) + leads by source chart + "Follow-ups Due Today" insight section
- `?tab=list`: filter bar (search + status dropdown + source dropdown) + Table/Kanban toggle + lazy-load table (25 per batch) or 6-column Kanban board
- "+ Add Lead" navigates to the dedicated full-page route `/leads/new` (replaces the legacy modal). Same `<ProductLineEditor />` as Add Order — supports inventory + custom mix.

#### Add Lead page (`/leads/new`)
- Full-page form with Lead Info (status / source / budget), Customer (search or add new), Products of Interest (`<ProductLineEditor />`), and Notes sections.
- Saves via `POST /api/leads` with `productLines` array. Each line includes cost / selling price / qty / articleId so the financials carry forward intact when the lead converts to an order.

#### Lead Detail page (`/leads/:leadId`)
- Header: customer name, phone, email, Lead ID chip, status badge (inline-editable via quick-stage buttons)
- Stats cards: Budget · Follow-up Date · Status · Linked Order
- Products Interested section: rich table (Product · Type pill · Cost · Price · Qty · Subtotal). Inventory lines show an "Inventory" pill; custom lines show a "Custom" pill. Editing the lead swaps to `<ProductLineEditor />` for full per-line edits.
- Notes section
- Conversion section: shown when status = Converted; shows "Create Order" button (or "View Order" link if already converted)
- Quick status change buttons: move lead to any other status with one click

### Backend Structure (Lead Management)
```
server/
  routes/leads.js          # Lead CRUD route handlers — GET, POST, GET/:id, PATCH/:id, DELETE/:id
  services/leadsSheets.js  # Google Sheets operations for Leads tab
                           # Functions: getAllLeads, getLeadById, addLead, updateLead, deleteLead
                           # ensureLeadsTab auto-creates the Leads tab + header row on first use
```

### Frontend Structure (Lead Management)
```
src/
  pages/
    Leads.jsx       # Main page — exports StatusBadge, LEAD_STATUSES, STATUS_CONFIG (reused by LeadDetail)
    LeadDetail.jsx  # Individual lead detail + edit + status change + conversion flow
  hooks/
    useLeads.js        # Fetch + filter leads; returns { leads, loading, error, refetch, setLeads }
    useLeadInsights.js # Client-side analytics derived from leads array (pure useMemo, no API calls)
  services/
    api.js          # Leads functions: fetchLeads, fetchLeadById, addLead, updateLead, deleteLead
```

### Phase 2 (Future — WhatsApp Automation)
- Trigger WhatsApp messages on lead status changes (e.g., auto-message when status → Contacted)
- Broadcast to filtered lead segments
- Auto-log WhatsApp replies as Notes on the lead
