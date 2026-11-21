# CampusBite — Development Roadmap

> Feature-by-feature build plan · Each phase completes a usable slice of the system

---

## How to Use This Roadmap

Each phase below is one buildable feature. We complete the **scaffold first**, then build **one feature at a time**, front-to-back (database → API → UI). Every feature ends with something testable in the browser.

**Definition of done for each feature:**
- Database migration applied (if schema changes)
- API endpoints working (tested with curl or Postman)
- Vue components rendering and functional
- Responsive on mobile and desktop
- Connected end-to-end (frontend calls real API)

---

## Phase 0 — Project Scaffold

**Goal:** Empty project that runs. Both servers start, database connects, a hello-world page loads.

### Tasks

- [ ] Initialize monorepo structure: `campusbite/client/` and `campusbite/server/`
- [ ] **Client setup:**
  - [ ] `npm create vue@latest` with Vue Router + Pinia
  - [ ] Install and configure Tailwind CSS
  - [ ] Create `App.vue` with `<RouterView />`
  - [ ] Create a placeholder `HomeView.vue` that says "CampusBite"
  - [ ] Verify: `npm run dev` loads the page
- [ ] **Server setup:**
  - [ ] `npm init`, install Express, Prisma, cors, dotenv, bcryptjs, jsonwebtoken
  - [ ] Create `src/index.js` with a health-check route `GET /api/v1/health`
  - [ ] Init Prisma: `npx prisma init` → generates `schema.prisma` with PostgreSQL
  - [ ] Configure `.env` with `DATABASE_URL`
  - [ ] Verify: `node src/index.js` → `GET /api/v1/health` returns `{ status: "ok" }`
- [ ] **Database:**
  - [ ] Create PostgreSQL database `campusbite_dev`
  - [ ] Run `npx prisma db push` to confirm connection
- [ ] Add `.gitignore` (node_modules, .env, dist)
- [ ] First commit

### Delivers
A running frontend at `localhost:5173` and backend at `localhost:3000` connected to an empty database.

---

## Phase 1 — Authentication (Register & Login)

**Goal:** Students and vendors can create accounts and log in. JWT stored in browser. Protected routes in place.

### Database

```prisma
model User {
  id            Int       @id @default(autoincrement())
  name          String
  email         String    @unique
  password_hash String
  role          Role
  created_at    DateTime  @default(now())
  vendor        Vendor?
  orders        Order[]
}

enum Role {
  STUDENT
  VENDOR
}
```

### API Endpoints

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/v1/auth/register` | `{ name, email, password, role }` | `{ user, token }` |
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ user, token }` |
| GET | `/api/v1/auth/me` | — (JWT header) | `{ user }` |

### Backend Tasks

- [ ] Add User model to `schema.prisma`, run migration
- [ ] Create `routes/auth.js`:
  - [ ] `POST /register` — hash password with bcrypt, create user, return JWT
  - [ ] `POST /login` — verify email + password, return JWT
  - [ ] `GET /me` — decode JWT, return user (no password_hash)
- [ ] Create `middleware/auth.js` — verify JWT, attach `req.user`
- [ ] Create `middleware/roleGuard.js` — check `req.user.role` against allowed roles

### Frontend Tasks

- [ ] Create `stores/auth.js` (Pinia):
  - State: `user`, `token`
  - Actions: `register()`, `login()`, `logout()`, `fetchMe()`
  - Persist token in `localStorage`
- [ ] Create `composables/useApi.js`:
  - Axios instance with `baseURL` and automatic `Authorization` header from auth store
- [ ] Create `views/auth/RegisterView.vue`:
  - Form: name, email, password, role (student or vendor radio)
  - Validation: all fields required, email format, password min 6 chars
  - On success: redirect to home (student) or vendor dashboard (vendor)
- [ ] Create `views/auth/LoginView.vue`:
  - Form: email, password
  - On success: redirect by role
- [ ] Create `components/common/AppHeader.vue`:
  - Logo/name, navigation links based on role, login/logout button
- [ ] Add route guards in `router/index.js`:
  - `/vendor/*` routes require `role === 'VENDOR'`
  - `/orders/*` routes require authentication
  - Redirect unauthenticated users to login

### Delivers
Users can register as student or vendor, log in, and see role-appropriate navigation. JWT persists across page refresh.

---

## Phase 2 — Vendor Profile & Shop Setup

**Goal:** Vendors set up their shop (name, description, location, phone). Shop profiles are publicly viewable.

### Database

```prisma
model Vendor {
  id          Int       @id @default(autoincrement())
  user_id     Int       @unique
  user        User      @relation(fields: [user_id], references: [id])
  shop_name   String
  description String?
  location    String
  phone       String
  is_open     Boolean   @default(false)
  image_url   String?
  created_at  DateTime  @default(now())
  menu_items  MenuItem[]
  orders      Order[]
}
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/vendor/profile` | Vendor | Create vendor profile (first time) |
| PUT | `/api/v1/vendor/profile` | Vendor | Update shop details |
| PATCH | `/api/v1/vendor/status` | Vendor | Toggle open/closed |
| GET | `/api/v1/vendors` | Public | List all vendors |
| GET | `/api/v1/vendors/:id` | Public | Single vendor detail |

### Backend Tasks

- [ ] Add Vendor model to schema, run migration
- [ ] Create `routes/vendors.js` (public):
  - [ ] `GET /` — list vendors (id, shop_name, location, is_open, image_url)
  - [ ] `GET /:id` — vendor detail with full info
- [ ] Create `routes/vendor-profile.js` (authenticated vendor):
  - [ ] `POST /profile` — create vendor profile linked to user
  - [ ] `PUT /profile` — update shop_name, description, location, phone, image
  - [ ] `PATCH /status` — toggle is_open

### Frontend Tasks

- [ ] Create `views/vendor/DashboardView.vue`:
  - Show shop status (open/closed toggle)
  - Quick stats placeholder (will fill with order counts in Phase 5)
  - Link to menu management and order management
- [ ] Create a shop setup form (shown if vendor has no profile yet):
  - Fields: shop_name, description, location, phone
  - Image upload (optional)
- [ ] Create `views/HomeView.vue`:
  - List all vendors as cards
  - Each card: shop name, location, open/closed badge, image
  - Click card → vendor detail page
- [ ] Create `components/student/VendorCard.vue`:
  - Shop name, location, open/closed status, image thumbnail
- [ ] Create `stores/vendors.js`:
  - Actions: `fetchVendors()`, `fetchVendor(id)`

### Delivers
Vendors create their shop profile. The home page lists all vendors. Students can browse vendors and see who is open.

---

## Phase 3 — Digital Menu (Core Feature)

**Goal:** Vendors add, edit, and remove menu items. Students browse the full menu on a vendor's page. Prices and availability are clear.

### Database

```prisma
model MenuItem {
  id           Int       @id @default(autoincrement())
  vendor_id    Int
  vendor       Vendor    @relation(fields: [vendor_id], references: [id])
  name         String
  description  String?
  price        Int                // Price in RWF (integer, no decimals)
  category     String?            // e.g. "Main", "Drink", "Snack"
  image_url    String?
  is_available Boolean   @default(true)
  created_at   DateTime  @default(now())
  order_items  OrderItem[]
}
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/vendors/:id/menu` | Public | List menu items for a vendor |
| POST | `/api/v1/vendor/menu` | Vendor | Add menu item |
| PUT | `/api/v1/vendor/menu/:id` | Vendor | Edit menu item |
| DELETE | `/api/v1/vendor/menu/:id` | Vendor | Remove menu item |
| PATCH | `/api/v1/vendor/menu/:id/availability` | Vendor | Toggle available/unavailable |

### Backend Tasks

- [ ] Add MenuItem model to schema, run migration
- [ ] Create `routes/menu.js`:
  - [ ] Public `GET /vendors/:id/menu` — returns items grouped by category, only available items for students (or all for the vendor's own view)
  - [ ] Vendor-only CRUD routes with ownership check (vendor can only manage own items)
- [ ] Add request validation (name required, price > 0)

### Frontend Tasks

- [ ] Create `views/VendorDetailView.vue`:
  - Vendor info header (name, description, location, status)
  - Menu items listed below, grouped by category
  - Each item: name, description, price, availability, image
  - "Add to Order" button on each available item
- [ ] Create `components/student/MenuItemCard.vue`:
  - Displays one menu item with price prominently shown (`PriceTag` component)
  - Availability indicator
  - Add button (disabled if unavailable)
- [ ] Create `components/common/PriceTag.vue`:
  - Formats integer price as `1,500 RWF`
- [ ] Create `views/vendor/MenuManageView.vue`:
  - List of own menu items with edit/delete/toggle controls
  - "Add Item" button opens form
- [ ] Create `components/vendor/MenuItemForm.vue`:
  - Fields: name, description, price, category (dropdown), image upload
  - Used for both create and edit

### Delivers
Vendors manage their full menu. Students browse any vendor's menu with clear prices and availability. This is the **digital menu** and **price comparison** core feature — students can open multiple vendors and compare.

---

## Phase 4 — Pre-Order & Cart (Core Feature)

**Goal:** Students select items, set quantities, choose a pickup time, and submit an order. This is the pre-order form.

### Database

```prisma
model Order {
  id           Int         @id @default(autoincrement())
  student_id   Int
  student      User        @relation(fields: [student_id], references: [id])
  vendor_id    Int
  vendor       Vendor      @relation(fields: [vendor_id], references: [id])
  status       OrderStatus @default(SUBMITTED)
  pickup_time  DateTime
  total_amount Int                  // RWF integer
  note         String?
  created_at   DateTime    @default(now())
  updated_at   DateTime    @updatedAt
  items        OrderItem[]
}

model OrderItem {
  id           Int      @id @default(autoincrement())
  order_id     Int
  order        Order    @relation(fields: [order_id], references: [id])
  menu_item_id Int
  menu_item    MenuItem @relation(fields: [menu_item_id], references: [id])
  quantity     Int
  unit_price   Int      // Price at time of order (RWF)
  subtotal     Int      // quantity * unit_price
}

enum OrderStatus {
  SUBMITTED
  ACCEPTED
  PREPARING
  READY
  COMPLETED
  CANCELLED
}
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/orders` | Student | Place order |
| GET | `/api/v1/orders` | Student | List own orders |
| GET | `/api/v1/orders/:id` | Student | Order detail |

### Request Body for `POST /orders`

```json
{
  "vendor_id": 1,
  "pickup_time": "2025-03-15T12:30:00Z",
  "note": "No onions please",
  "items": [
    { "menu_item_id": 5, "quantity": 2 },
    { "menu_item_id": 8, "quantity": 1 }
  ]
}
```

### Backend Tasks

- [ ] Add Order, OrderItem models and OrderStatus enum, run migration
- [ ] Create `routes/orders.js`:
  - [ ] `POST /` — validate items exist and belong to same vendor, check availability, calculate totals from current prices (never trust client-sent prices), create order + items in a transaction
  - [ ] `GET /` — list student's orders with status, vendor name, total, pickup time
  - [ ] `GET /:id` — full order detail with items
- [ ] Validation: pickup_time must be in the future, at least 1 item, quantities > 0

### Frontend Tasks

- [ ] Create `stores/cart.js` (Pinia):
  - State: `items[]` (menu_item_id, name, price, quantity, vendor_id), `vendor_id`
  - Actions: `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`
  - Constraint: all items must be from the same vendor (clear cart if switching vendor)
  - Computed: `totalAmount`, `itemCount`
- [ ] Create `components/student/CartDrawer.vue`:
  - Slide-out panel showing current cart
  - Each item: name, quantity controls (+/-), subtotal, remove button
  - Total amount at bottom
  - "Proceed to Checkout" button
- [ ] Create `components/student/PickupTimePicker.vue`:
  - Time picker for today, minimum 30 minutes from now
  - Slots in 15-minute increments
- [ ] Create `views/student/OrderCheckoutView.vue`:
  - Review order items and total
  - Pickup time selector
  - Optional note field
  - "Place Order" button → POST to API → redirect to order tracking
- [ ] Add cart icon with item count badge to `AppHeader.vue`

### Delivers
Students can build an order from a vendor's menu, choose a pickup time, and submit. The core **pre-order form** feature is complete.

---

## Phase 5 — Order Status Tracking (Core Feature)

**Goal:** Students see their order status in real time. Vendors see incoming orders and update status through the workflow.

### Status Flow

```
SUBMITTED → ACCEPTED → PREPARING → READY → COMPLETED
     │          │           │         │
     └──────────┴───────────┴─────────┴──→ CANCELLED
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/vendor/orders` | Vendor | List incoming orders (filterable by status) |
| PATCH | `/api/v1/vendor/orders/:id/status` | Vendor | Advance or cancel order |

### Status Transition Rules

| Current | Allowed Next |
|---------|-------------|
| SUBMITTED | ACCEPTED, CANCELLED |
| ACCEPTED | PREPARING, CANCELLED |
| PREPARING | READY, CANCELLED |
| READY | COMPLETED, CANCELLED |
| COMPLETED | _(terminal)_ |
| CANCELLED | _(terminal)_ |

### Backend Tasks

- [ ] Create `routes/vendor-orders.js`:
  - [ ] `GET /` — list orders for this vendor, default sorted by created_at desc, filterable by status query param
  - [ ] `PATCH /:id/status` — validate transition is allowed, update status and updated_at
- [ ] Add ownership check: vendor can only manage their own orders

### Frontend Tasks

- [ ] Create `views/student/OrderTrackingView.vue`:
  - Show current order status with the visual stepper (progress bar through the 5 states)
  - Order details: items, total, pickup time, vendor name
  - Auto-refresh status every 30 seconds (polling; websockets out of v1 scope)
- [ ] Create `components/student/OrderStatusTracker.vue`:
  - Visual progress stepper: 5 circles connected by a line
  - Current step highlighted with its status color
  - Cancelled state shown as a red override
- [ ] Create `components/common/StatusBadge.vue`:
  - Color-coded badge per status (see Blueprint §8)
- [ ] Create `views/vendor/OrderManageView.vue`:
  - Incoming orders listed as cards, most recent first
  - Filter tabs: All | New | In Progress | Ready | Done
  - Each card: student name, items summary, pickup time, total, current status
- [ ] Create `components/vendor/OrderCard.vue`:
  - Order summary with status badge
  - Action button: shows the next valid status ("Accept", "Start Preparing", "Mark Ready", "Complete")
  - Cancel button (available until completed)
- [ ] Create `components/vendor/StatusUpdater.vue`:
  - Confirmation dialog before status change
- [ ] Update `views/vendor/DashboardView.vue`:
  - Show live counts: new orders, preparing, ready for pickup

### Delivers
The full **order status** workflow. Students track their orders. Vendors manage their order queue with one-click status updates. The **vendor dashboard** shows order activity.

---

## Phase 6 — Order History

**Goal:** Students review past orders. Vendors can review completed/cancelled orders.

### API Additions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/orders?status=completed,cancelled` | Student | Filter past orders |
| GET | `/api/v1/vendor/orders?status=completed,cancelled` | Vendor | Vendor's past orders |

### Frontend Tasks

- [ ] Create `views/student/OrderHistoryView.vue`:
  - List of past orders (completed + cancelled)
  - Each row: date, vendor name, items summary, total, status badge
  - Click to expand full detail
  - "Reorder" button that pre-fills cart with the same items (nice-to-have)
- [ ] Add "Order History" link to student navigation
- [ ] Add completed/cancelled tab or filter to vendor's order management view

### Delivers
The **order history** feature from the project spec. Students and vendors can review past activity.

---

## Phase 7 — Price Comparison Enhancement

**Goal:** Make price comparison effortless across vendors, as specified in the project requirements.

### Frontend Tasks

- [x] Enhance `HomeView.vue`:
  - Added a search bar to filter vendors by name or location
  - Added category filter pills (Main, Drink, Snack, Dessert, Breakfast)
- [x] Create a comparison-friendly view:
  - Built `MenuSearchView.vue` — search all menus across vendors, see prices ranked cheapest first
  - Items grouped by name, vendors listed with prices, open/closed status, and Add to cart
- [x] Ensure consistent `PriceTag` formatting across all views
- [x] Add sorting options on vendor list: by name, by location, open first

### API Addition

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/menu/search?q=rice` | Public | Search menu items across all vendors |

### Delivers
Students can easily **compare prices** before choosing a meal, fulfilling the price comparison requirement.

---

## Phase 8 — Polish & Non-Functional Requirements

**Goal:** Address all non-functional requirements from the project spec. Harden the application.

### Responsive Design (Usability)

- [x] Audit every view at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- [x] Ensure touch-friendly tap targets (min 44px)
- [x] Test cart and checkout flow on mobile
- [x] Add proper loading states and skeleton screens
- [x] Mobile hamburger menu in AppHeader
- [x] 404 Not Found page

### Security

- [x] Confirm all vendor routes check ownership (can't edit another vendor's menu)
- [x] Rate limiting on auth routes (prevent brute force)
- [x] Input sanitization on all text fields
- [x] Helmet.js for HTTP headers on Express
- [x] CORS configured to allow only the frontend origin

### Privacy

- [x] Confirm registration collects only: name, email, password, role
- [x] Vendor profile collects only: shop_name, description, location, phone
- [x] Orders store only what's needed to process them
- [x] No unnecessary data exposed in API responses (e.g., password_hash never returned)

### Reliability

- [x] Database transactions for order placement (all items or none)
- [x] Proper error handling on all API routes (try/catch, error middleware)
- [x] Frontend error boundaries and user-friendly error messages
- [x] Form validation on both frontend and backend

### Seed Data

- [x] Create `prisma/seed.js` with:
  - 3 vendor accounts with shop profiles
  - 5-8 menu items per vendor across categories
  - 2 student accounts
  - A few sample orders in various statuses
- [x] Document seed command: `npx prisma db seed`

### Delivers
The app meets all non-functional requirements: usable, secure, private, reliable. Ready for prototype testing.

---

## Phase Summary

| Phase | Feature | Maps to Project Spec |
|-------|---------|---------------------|
| 0 | Scaffold | — |
| 1 | Authentication | System requirement (authorized vendors) |
| 2 | Vendor Profile | Vendor setup, public vendor listing |
| 3 | Digital Menu | §2.4 Digital menu, price visibility |
| 4 | Pre-Order & Cart | §2.4 Pre-order form, pickup time |
| 5 | Order Status | §2.4 Order status, §2.4 Vendor dashboard |
| 6 | Order History | §2.4 Order history |
| 7 | Price Comparison | §2.4 Price comparison |
| 8 | Polish | §2.5.2 Non-functional requirements |

---

## Development Rules

1. **One phase at a time.** Don't start the next until the current one works end-to-end.
2. **Backend first, then frontend.** For each phase, get the API working before building the UI.
3. **Test in the browser.** Every phase ends with a manual walk-through of the feature.
4. **Commit per phase.** Each completed phase gets its own git commit with a clear message.
5. **Don't over-engineer.** Build what the spec says. Add complexity only when a requirement demands it.
6. **Mobile check.** After completing each phase's frontend, resize the browser to 375px and verify.

---

## Spec Coverage Checklist

Before calling the project complete, verify every spec requirement is met:

- [ ] **§2.4 Digital menu** — Vendors list meal names, descriptions, prices, availability → Phase 3
- [ ] **§2.4 Price comparison** — Students review prices before choosing → Phase 7
- [ ] **§2.4 Pre-order form** — Students select items, quantities, pickup time → Phase 4
- [ ] **§2.4 Order status** — Submitted → Accepted → Preparing → Ready for Pickup → Completed / Cancelled → Phase 5
- [ ] **§2.4 Vendor dashboard** — View incoming orders, update statuses, manage menu → Phase 5
- [ ] **§2.4 Order history** — Users review recent orders → Phase 6
- [ ] **§2.5.2 Usability** — Simple on phones and computers → Phase 8
- [ ] **§2.5.2 Security** — Only authorized vendors manage vendor functions → Phase 1 + 8
- [ ] **§2.5.2 Privacy** — Collect only information needed to process orders → Phase 8
- [ ] **§2.5.2 Reliability** — Order information stored accurately → Phase 4 + 8
- [ ] **§2.6 Workflow step 1** — Vendor adds meals, prices, availability → Phase 3
- [ ] **§2.6 Workflow step 2** — Student browses menus, selects meals → Phase 3
- [ ] **§2.6 Workflow step 3** — Student chooses quantities, pickup time, submits → Phase 4
- [ ] **§2.6 Workflow step 4** — Vendor views order, updates status → Phase 5
- [ ] **§2.6 Workflow step 5** — Student collects meal, vendor marks completed → Phase 5
- [ ] **§2.8 Scope** — No delivery, no driver tracking, no demand prediction, no multi-campus

Companion document: [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) — architecture, schema, and design decisions.
