# CampusBite — Project Blueprint

> Student Food Pre-Ordering Platform · University of Rwanda, UR-CST · Group 5

---

## 1. Product Vision

CampusBite connects university students with small on-campus food vendors through a pre-ordering system. Students browse digital menus, compare prices, and place pickup orders. Vendors receive orders, manage menus, and update order status — all from a simple dashboard.

**Version 1 scope:** Pickup orders only. No delivery, no driver tracking, no demand prediction, no multi-campus.

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Vue 3 (Composition API) + Vue Router + Pinia | Reactive, component-driven, pairs with feature-per-feature workflow |
| **UI Framework** | Tailwind CSS | Utility-first, responsive by default, fast prototyping |
| **Backend** | Express.js (Node.js) | Lightweight, flexible, massive ecosystem |
| **ORM** | Prisma | Type-safe queries, clean migrations, visual schema |
| **Database** | PostgreSQL | Relational integrity for orders, menus, users |
| **Auth** | JSON Web Tokens (JWT) + bcrypt | Stateless auth, role-based (student vs vendor) |
| **File Storage** | Local uploads (v1) | Meal images; can migrate to cloud later |
| **Dev Tools** | Vite, ESLint, Prettier | Fast HMR, consistent code style |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                     CLIENT (Vue 3)                   │
│                                                      │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │  Student App  │    │      Vendor Dashboard     │  │
│  │  - Browse     │    │  - Menu management        │  │
│  │  - Compare    │    │  - Order queue             │  │
│  │  - Order      │    │  - Status updates          │  │
│  │  - Track      │    │                            │  │
│  └──────┬───────┘    └────────────┬──────────────┘  │
│         │                         │                   │
│         └────────┬────────────────┘                   │
│                  │ Axios HTTP                         │
└──────────────────┼───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│                  API SERVER (Express.js)              │
│                                                       │
│  ┌────────┐  ┌────────┐  ┌─────────┐  ┌──────────┐ │
│  │  Auth   │  │ Menus  │  │ Orders  │  │  Users   │ │
│  │ Routes  │  │ Routes │  │ Routes  │  │  Routes  │ │
│  └───┬────┘  └───┬────┘  └────┬────┘  └────┬─────┘ │
│      │           │            │             │        │
│      └─────┬─────┴────────────┴─────────────┘        │
│            │  Middleware: auth, validation, errors    │
│            ▼                                          │
│      ┌──────────┐                                    │
│      │  Prisma   │                                   │
│      │   ORM     │                                   │
│      └─────┬────┘                                    │
└────────────┼─────────────────────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │  PostgreSQL   │
      │   Database    │
      └──────────────┘
```

---

## 4. User Roles & Permissions

| Action | Student | Vendor | Unauthenticated |
|--------|---------|--------|-----------------|
| View vendor list & menus | ✅ | ✅ | ✅ |
| Compare prices across vendors | ✅ | ✅ | ✅ |
| Place an order | ✅ | ❌ | ❌ |
| View own order history | ✅ | ❌ | ❌ |
| Track order status | ✅ | ❌ | ❌ |
| Add/edit menu items | ❌ | ✅ (own only) | ❌ |
| View incoming orders | ❌ | ✅ (own only) | ❌ |
| Update order status | ❌ | ✅ (own only) | ❌ |
| Register / Login | ✅ | ✅ | — |

---

## 5. Database Schema

```
┌──────────────────┐       ┌──────────────────────┐
│      users        │       │      vendors          │
├──────────────────┤       ├──────────────────────┤
│ id          PK   │       │ id             PK    │
│ name             │       │ user_id     FK→users │
│ email    UNIQUE  │       │ shop_name          │
│ password_hash    │       │ description        │
│ role  (student│  │       │ location           │
│       vendor)    │       │ phone              │
│ created_at       │       │ is_open   BOOLEAN  │
└────────┬─────────┘       │ image_url          │
         │                 │ created_at         │
         │                 └──────────┬─────────┘
         │                            │
         │                 ┌──────────┴─────────┐
         │                 │    menu_items        │
         │                 ├─────────────────────┤
         │                 │ id            PK    │
         │                 │ vendor_id FK→vendors│
         │                 │ name               │
         │                 │ description        │
         │                 │ price     DECIMAL  │
         │                 │ category           │
         │                 │ image_url          │
         │                 │ is_available BOOL  │
         │                 │ created_at         │
         │                 └─────────────────────┘
         │
┌────────┴─────────┐       ┌──────────────────────┐
│     orders        │       │    order_items        │
├──────────────────┤       ├──────────────────────┤
│ id          PK   │       │ id             PK    │
│ student_id    FK │──┐    │ order_id    FK→orders│
│ vendor_id     FK │  │    │ menu_item_id FK→     │
│ status           │  │    │              menu_items
│  (submitted│     │  │    │ quantity     INT     │
│   accepted│      │  │    │ unit_price  DECIMAL  │
│   preparing│     │  │    │ subtotal    DECIMAL  │
│   ready│         │  │    └──────────────────────┘
│   completed│     │  │
│   cancelled)     │  │
│ pickup_time      │  │
│ total_amount DEC │  │
│ note        TEXT  │  │
│ created_at       │  │
│ updated_at       │  │
└──────────────────┘  │
                      │
                      └── student_id references users.id
```

---

## 6. API Design

Base URL: `/api/v1`

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register student or vendor |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user profile |

### Vendors (public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vendors` | List all vendors (with open/closed status) |
| GET | `/vendors/:id` | Vendor detail + menu |
| GET | `/vendors/:id/menu` | Full menu with prices and availability |

### Menu Management (vendor auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/vendor/menu` | Add a menu item |
| PUT | `/vendor/menu/:id` | Edit menu item (price, availability, etc.) |
| DELETE | `/vendor/menu/:id` | Remove menu item |
| PATCH | `/vendor/status` | Toggle shop open/closed |

### Orders (student auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Place a new order (items + pickup time) |
| GET | `/orders` | List own orders (with status) |
| GET | `/orders/:id` | Order detail with items and status |

### Order Management (vendor auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vendor/orders` | List incoming orders |
| PATCH | `/vendor/orders/:id/status` | Update order status |

---

## 7. Frontend Structure

```
src/
├── assets/                  # Static images, fonts
├── components/
│   ├── common/              # Shared UI components
│   │   ├── AppHeader.vue
│   │   ├── AppFooter.vue
│   │   ├── LoadingSpinner.vue
│   │   ├── StatusBadge.vue
│   │   └── PriceTag.vue
│   ├── student/
│   │   ├── VendorCard.vue
│   │   ├── MenuItemCard.vue
│   │   ├── CartDrawer.vue
│   │   ├── OrderSummary.vue
│   │   ├── PickupTimePicker.vue
│   │   └── OrderStatusTracker.vue
│   └── vendor/
│       ├── MenuItemForm.vue
│       ├── OrderCard.vue
│       ├── OrderQueue.vue
│       └── StatusUpdater.vue
├── views/
│   ├── HomeView.vue              # Landing / vendor list
│   ├── VendorDetailView.vue      # Single vendor + menu
│   ├── auth/
│   │   ├── LoginView.vue
│   │   └── RegisterView.vue
│   ├── student/
│   │   ├── OrderCheckoutView.vue
│   │   ├── OrderTrackingView.vue
│   │   └── OrderHistoryView.vue
│   └── vendor/
│       ├── DashboardView.vue
│       ├── MenuManageView.vue
│       └── OrderManageView.vue
├── router/
│   └── index.js                  # Route definitions + guards
├── stores/
│   ├── auth.js                   # User session, JWT
│   ├── vendors.js                # Vendor list, menus
│   ├── cart.js                   # Cart state (pre-order items)
│   └── orders.js                 # Order placement, tracking
├── composables/
│   ├── useAuth.js                # Auth logic
│   ├── useApi.js                 # Axios instance + interceptors
│   └── useToast.js               # Notification feedback
├── App.vue
└── main.js
```

---

## 8. UI/UX Design Principles

Drawn directly from the project's non-functional requirements:

1. **Mobile-first responsive** — The interface should be simple on phones and computers. Design for 375px up.
2. **Role-aware navigation** — Students see menus and orders. Vendors see their dashboard. Each role gets only what they need.
3. **Status visibility** — Order status (Submitted → Accepted → Preparing → Ready → Completed/Cancelled) should be obvious at a glance via color-coded badges.
4. **Minimal data collection** — Registration asks only for name, email, password, and role. Vendors add shop info. No extra fields.
5. **Price clarity** — Every price is visible, formatted consistently (RWF). Price comparison is effortless through consistent card layouts.

### Status Color System

| Status | Color | Meaning |
|--------|-------|---------|
| Submitted | Blue | Order placed, awaiting vendor |
| Accepted | Amber | Vendor confirmed |
| Preparing | Orange | Being prepared |
| Ready for Pickup | Green | Go collect your food (maps to `READY` in code) |
| Completed | Gray | Done |
| Cancelled | Red | Cancelled |

---

## 9. Project Directory Layout

```
campusbite/
├── client/                    # Vue 3 frontend
│   ├── public/
│   ├── src/                   # (see section 7)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/                    # Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── vendors.js
│   │   │   ├── menu.js
│   │   │   └── orders.js
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT verification
│   │   │   ├── roleGuard.js   # Role-based access
│   │   │   └── validate.js    # Request validation
│   │   ├── utils/
│   │   │   └── errors.js
│   │   └── index.js           # Express app entry
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Sample data for dev
│   └── package.json
├── docs/                      # Project documents
├── PROJECT_BLUEPRINT.md       # This file
├── DEVELOPMENT_ROADMAP.md     # Feature-by-feature plan
└── README.md
```

---

## 10. Key Conventions

- **Naming:** Vue components PascalCase, files kebab-case or PascalCase matching component name. API routes lowercase plural nouns.
- **State:** Pinia stores for shared state only. Local component state with `ref`/`reactive` when it doesn't need sharing.
- **API calls:** Always through the `useApi` composable (centralized Axios instance with JWT header injection and error handling).
- **Validation:** Backend validates all input. Frontend validates for UX only (immediate feedback), never trusts client-side validation alone.
- **Errors:** Backend returns `{ error: "message" }` with appropriate HTTP status. Frontend shows user-friendly toast messages.
- **Currency:** All prices stored as integers (RWF, no decimals) to avoid floating-point issues. Display formatted as `1,500 RWF`.

---

## 11. Spec Traceability

Every feature in this blueprint traces back to the project proposal (E-commerce_Project_.pdf):

| Spec Section | Blueprint Coverage |
|---|---|
| §2.1 Aim — easy-to-use online system for preordering | Full system design above |
| §2.4 Digital menu | §5 MenuItem model, §6 Menu API, §7 MenuItemCard |
| §2.4 Price comparison | §7 PriceTag component, consistent card layout |
| §2.4 Pre-order form | §5 Order/OrderItem models, §6 Orders API, §7 Cart/Checkout |
| §2.4 Order status | §5 OrderStatus enum (6 states), §6 vendor order routes |
| §2.4 Vendor dashboard | §7 vendor views (Dashboard, MenuManage, OrderManage) |
| §2.4 Order history | §6 student order list endpoint, §7 OrderHistoryView |
| §2.5.1 Functional reqs | Covered by API + UI for each feature |
| §2.5.2 Usability | §8 Mobile-first, Tailwind responsive |
| §2.5.2 Security | §4 Role permissions, §6 auth middleware |
| §2.5.2 Privacy | §10 Minimal data, password never exposed |
| §2.5.2 Reliability | §10 Integer currency, backend validation |
| §2.6 Workflow (5 steps) | Matches Phase 2→3→4→5 in DEVELOPMENT_ROADMAP.md |
| §2.8 Out of scope | No delivery, no driver tracking, no demand prediction, no multi-campus |

Companion document: [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) — phase-by-phase build plan.
