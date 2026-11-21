# CampusBite

Food pre-ordering for the UR-CST campus. Students browse stalls, compare dishes, pay with MoMo/Airtel (simulated) or cash, and pick up when the order is ready. Vendors run their stall from a separate workspace: live order board, menu, reviews, promo codes and sales numbers.

**Stack:** Vue 3 · Pinia · Tailwind CSS v4 · Vite — Express 5 · Prisma 6 · PostgreSQL

> Academic prototype by Group 5, Year 3 Computer Science, University of Rwanda (UR-CST). Food photos come from [Unsplash](https://unsplash.com) under the Unsplash License. All shops, people, orders and reviews in the demo data are fictional, and no real payments are made.

![Vendor receiving a new order](docs/screenshots/order-flow/12-vendor-receives-new-order.png)

---

## Contents

1. [What you need](#1-what-you-need)
2. [Get the code](#2-get-the-code)
3. [Set up PostgreSQL](#3-set-up-postgresql)
4. [Configure and start the API](#4-configure-and-start-the-api)
5. [Create the seed data](#5-create-the-seed-data)
6. [Start the web app](#6-start-the-web-app)
7. [Test it](#7-test-it)
8. [Troubleshooting](#8-troubleshooting)
9. [Project structure](#9-project-structure)
10. [How it maps to the project brief](#10-how-it-maps-to-the-project-brief)

---

## 1. What you need

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20 or newer (22 recommended) | `node -v` |
| npm | comes with Node | `npm -v` |
| PostgreSQL | 14 or newer | `psql --version` |
| Git | any | `git --version` |

You also need an internet connection in the browser: the demo food photos and fonts load from Unsplash and Google Fonts.

## 2. Get the code

```bash
git clone git@github.com:nisloy/campus-bite.git
cd campus-bite
```

## 3. Set up PostgreSQL

Pick **one** of these options.

**Option A: PostgreSQL installed on your machine (Ubuntu/Debian)**

```bash
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb campusbite_dev
```

On macOS with Homebrew: `brew install postgresql@16 && brew services start postgresql@16 && createdb campusbite_dev`. On Windows, use the installer from postgresql.org, then create a database called `campusbite_dev` in pgAdmin.

**Option B: Docker**

```bash
docker run --name campusbite-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=campusbite_dev -p 5432:5432 -d postgres:16
```

Either way you end up with this connection string:

```
postgresql://postgres:postgres@localhost:5432/campusbite_dev
```

## 4. Configure and start the API

```bash
cd server
cp .env.example .env
```

Open `server/.env` and check the values:

| Variable | What it is | Example |
|---|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string from step 3 | `postgresql://postgres:postgres@localhost:5432/campusbite_dev` |
| `JWT_SECRET` | Any long random string, used to sign logins | run `openssl rand -hex 32` and paste the output |
| `PORT` | Port for the API | `3001` |
| `TZ` | Campus time zone for opening hours and pickup slots | `Africa/Kigali` |
| `CLIENT_URL` | Only needed if the web app calls the API from another origin | `http://localhost:5173` |

Then install the dependencies and create the tables:

```bash
npm install
npx prisma db push
```

`prisma db push` creates every table from `server/prisma/schema.prisma` and generates the database client. You should see *"Your database is now in sync with your Prisma schema."*

## 5. Create the seed data

Still in `server/`:

```bash
npm run db:seed
```

> **Warning:** the seed **empties every table first** (`TRUNCATE … RESTART IDENTITY`), then fills them. Don't run it against a database with data you want to keep.

It takes about two seconds and prints a summary like this:

```
{ students: 40, vendors: 10, menu_items: 91, orders: 1810, reviews: 705, review_photos: 254, promos: 8 }
```

**What it creates.** The seed is deterministic: the same input gives the same shops, menus and history every time.

- **10 shops** with cover photos, opening hours, prep times and pickup-slot limits. Kigali Bowl is paused, so you can see a closed shop.
- **91 dishes** with prices in RWF. Most have photos, and one per shop may be sold out.
- **40 students** and 10 vendor owners. All passwords are `password123`.
- **~1,800 orders** spread over the last 30 days. Today's orders include a live queue for every open shop.
- **~700 reviews**, about 40% written in Kinyarwanda. Around 250 have photos, and many have owner replies.
- **8 promo codes**, e.g. `KARIBU10` (Mama Marie's) and `SMASH2026` (Burger Lab). One is switched off.
- Saved shops, plus checkout-time and ease-of-ordering samples for the evaluation page.

**Re-seeding.** Run `npm run db:seed` again at any time to reset to a clean demo state. This is useful after testing. If you change `schema.prisma`, run `npx prisma db push` first.

**Start the API:**

```bash
npm run dev
```

It prints `Server running on http://localhost:3001`. Check it with:

```bash
curl http://localhost:3001/api/v1/health
```

It should answer `{"status":"ok"}`.

## 6. Start the web app

In a **second terminal**:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api` and `/uploads` to the API on port 3001.

Ports already taken? Run both on other ports:

```bash
cd server && PORT=3002 npm run dev
cd client && API_URL=http://localhost:3002 CLIENT_PORT=5174 npx vite
```

## 7. Test it

### Demo accounts

All passwords: `password123`. The login page also has **Student** and **Vendor** buttons that fill these in.

| Role | Email | What's there |
|---|---|---|
| Student | `eric@campusbite.test` | A live order being prepared, a past order waiting for a review, saved shops |
| Vendor | `marie@campusbite.test` | Mama Marie's Kitchen: a busy live board, 30 days of sales, unanswered reviews, promo codes |
| Vendor | `olivier@campusbite.test` | Burger Lab, open until 22:00. Good for testing in the evening. |
| Other vendors | `jean@` `aline@` `patrick@` `diane@` `claude@` `sandrine@` `emmanuel@` `fiona@` (all `…@campusbite.test`) | One shop each |
| Other students | `grace@` `david@` `clarisse@` `kevin@` … (40 in total) | Order history and reviews |

Shops only take orders during opening hours (Kigali time). Burger Lab and Pizza Corner stay open latest (22:00).

### 7.1 Automated API smoke test (about 5 seconds)

With the API running and the seed loaded, from `server/`:

```bash
npm run test:smoke
```

To point it at another port: `API_URL=http://localhost:3002 npm run test:smoke`.

It runs 33 checks through the real API:
- browse and search
- log in as a student and as the shop's owner
- place a MoMo order (dishes, quantities, pickup slot)
- pay, then move the order Submitted → Accepted → Preparing → Ready → Completed, and check the student sees every step
- check the live event stream: the vendor is pushed the new order and the student is pushed "Ready for pickup" instantly
- post a review with a photo
- cancel a paid order and check it's refunded
- guard rails: invalid phone, unknown promo code, wrong role, no login, phone numbers hidden on finished orders

The test creates real orders, so re-seed afterwards if you want clean data. If no shop is open at that hour, it exits with a message.

### 7.2 Manual walkthrough: student

Use two browser windows, or one normal and one private window, so the student and the vendor are logged in at the same time.

1. Open http://localhost:5173 without logging in. Browse shops, filter by cuisine or **Open now**, and open **Compare dishes** to search e.g. *chapati*.
2. Log in as `kevin@campusbite.test`.
3. Open **Burger Lab** (or any shop marked *Open*). Click **Add** on two dishes and use **+** to change a quantity.
4. Open the basket (top right) → **Checkout**.
5. Pick a **pickup time**. Each 10-minute slot shows how many places are left.
6. Type promo code `SMASH2026` → **Apply**. The total drops by 15%.
7. Leave **MTN MoMo** selected (the phone number is pre-filled) → **Place order**.
8. On the order page, answer *"How easy was it?"* and click **I've approved it** to simulate the MoMo payment. A green toast confirms it.
9. Keep this page open, or keep browsing other shops. Status changes arrive instantly (see 7.3). When the vendor marks it ready, a green **Ready for pickup** alert appears on whatever page you're on.
10. When it shows **Completed**, click **Write a review**, give stars, write a comment (English or Kinyarwanda) and add a photo.
11. Open the shop's **Reviews** tab and find your review with its photo.

Also try:
- **Cancel order** on a new order: the refund shows in the warning toast.
- **Order this again** on a past order.
- **Saved** shops (the heart icon).
- **Account**, to change your name, phone or password.

### 7.3 Manual walkthrough: vendor

1. In the second window, log in as `olivier@campusbite.test`. Vendors land in their own workspace, not the student pages.
2. Go to **Orders → Live board**. The top right says *Live: new orders appear instantly*. When the student places the order, the card appears straight away with a blue **New order** toast and a highlight, and a chime plays if *Sound for new orders* is on.
3. Click **Accept** → **Start preparing** → **Mark ready** → **Mark completed**. The student's window updates within a fraction of a second.
4. Try **Cancel** on another order. You must choose a reason, which the student sees.
5. **Menu:** add a dish with a photo, edit a price, switch a dish to *sold out*. Students then can't order it.
6. **Reviews:** filter by *Needs reply* and reply to one (many are in Kinyarwanda).
7. **Promotions:** create a code. Creating `SMASH2026` again shows a red error toast.
8. **Shop settings:** change opening hours, prep time, orders per pickup slot, and the cover photo.
9. Use the **Accepting orders** switch to pause the shop, then check that the shop page tells students it isn't taking orders.
10. **Overview:** today's sales vs yesterday, the 14-day chart, top sellers, busy hours.

### 7.4 Things worth checking

- **Slot limits:** in Shop settings set *Orders per 10-minute pickup slot* to `1`, then place two orders for the same time. The second is refused with *"That pickup time just filled up."*
- **Phone size:** open your browser's device toolbar at 375px wide. Every page works without sideways scrolling.
- **Evaluation numbers:** **How it works** (`/about`) shows live time-to-order, ease rating and completion rate.
- **Roles:** while logged in as a student, open `/vendor`. You're sent back to the storefront.

### 7.5 Live updates

Order changes are pushed to the browser the moment they happen, using **Server-Sent Events**:

1. Every logged-in browser keeps one connection to `GET /api/v1/stream`. The login token goes in the `Authorization` header, never in the URL.
2. When an order is created, paid, cancelled or changes status, the API sends an `order.created` or `order.updated` event to the student and the shop owner involved, and nobody else.
3. Screens refresh as soon as an event arrives. Measured in testing:
   - a new order reached the vendor board in about 0.1 s
   - "Ready for pickup" reached the student in under 0.1 s
4. If the connection drops, the browser reconnects automatically with back-off. It refetches anything it missed, and screens fall back to checking every 10–60 seconds until the connection is back.

**To see it:** open the student and vendor windows side by side and click **Mark ready**.

Each person can have up to 5 live connections, such as tabs, at once. Opening a sixth closes the oldest, and that tab falls back to periodic refresh. New connections are rate-limited, and the server caps the total. Events are held in memory, so this assumes one API process. Running several instances would need a shared channel such as Redis pub/sub or PostgreSQL `LISTEN/NOTIFY`.

### 7.6 Screenshots of the full flow

[`docs/screenshots/order-flow/`](docs/screenshots/order-flow/README.md) has 24 screenshots from recorded runs. They follow one order from the first visit to the vendor completing it, then show Kinyarwanda reviews, each toast type, and live updates arriving instantly.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| Pages show **"Internal server error"** right after changing `schema.prisma` or re-seeding | The running API still has the old database client loaded. Stop it (Ctrl+C) and run `npm run dev` again. |
| `P1001: Can't reach database server` | PostgreSQL isn't running, or `DATABASE_URL` is wrong. Check with `psql "postgresql://postgres:postgres@localhost:5432/campusbite_dev" -c "select 1"`. |
| `JWT_SECRET is not set` on start | You skipped `cp .env.example .env` in `server/`. |
| `EADDRINUSE` / port already in use | Another process uses 3001 or 5173. Use the alternative ports in step 6. |
| Login says *Too many attempts* | The login rate limit is 30 tries per 15 minutes. Wait, or restart the API. |
| No pickup times at checkout | The shop is closed for today, or past its last slot. Try Burger Lab (until 22:00) or change hours in Shop settings. |
| Photos don't show | The browser needs internet access to load Unsplash images. Uploaded photos are in `server/uploads/`. |
| Smoke test exits with *"No shop has pickup slots left"* | All shops are closed at this hour. Run it during opening hours. |
| Vendor board says *Reconnecting…* | The live connection dropped (API restarted, or a proxy is buffering). It reconnects by itself; meanwhile the board still refreshes every 10 seconds. |

## 9. Project structure

```
client/                      Vue 3 app
  src/layouts/               ShopLayout (students), VendorLayout (vendor workspace)
  src/views/shop/            Home, shop, search, checkout, orders, saved, account, about
  src/views/vendor/          Overview, orders board, menu, reviews, promotions, settings
  src/components/            ui/ (shared), shop/, vendor/
  src/assets/main.css        Design tokens (colour palette) and base components
server/                      Express API
  prisma/schema.prisma       Database schema
  prisma/seed.js             Demo data
  scripts/smoke-test.js      End-to-end API test
  src/realtime.js            Live order events (Server-Sent Events)
  src/routes/                auth, catalog (public), student, vendor
  src/middleware/            auth, role guard, uploads, sanitising, errors
docs/                        Project proposal and screenshots
```

### API overview (`/api/v1`)

| Area | Endpoints |
|---|---|
| Live | `GET /stream` (Server-Sent Events: `order.created`, `order.updated`) |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me`, `POST /auth/me/password` |
| Public | `GET /vendors`, `/vendors/:id`, `/vendors/:id/reviews`, `/vendors/:id/slots`, `/menu/search`, `/menu/popular`, `/menu/categories`, `/insights` |
| Student | `POST/GET /orders`, `GET /orders/:id`, `POST /orders/:id/pay \| cancel \| review \| ease`, `POST /promos/validate`, `GET/PUT/DELETE /favorites` |
| Vendor | `GET/POST/PUT /vendor/profile`, `POST /vendor/profile/images`, `PATCH /vendor/status`, `/vendor/menu…`, `/vendor/orders…`, `GET /vendor/stats`, `GET /vendor/badges`, `/vendor/reviews…`, `/vendor/promos…` |

## 10. How it maps to the project brief

The brief is `E-commerce_Project_.pdf`, the group's proposal.

| Brief | Where |
|---|---|
| Digital menu, availability (§2.4) | Shop page; vendor Menu with one-tap sold-out switch |
| Price comparison | Compare dishes (`/search`) |
| Pre-order form: items, quantities, pickup time | Basket → Checkout with pickup slots |
| Order status: Submitted → Accepted → Preparing → Ready for pickup → Completed / Cancelled | Order page timeline, vendor live board |
| Vendor dashboard, order history | `/vendor`, `/orders` |
| Security: only vendors manage vendor functions (§2.5.2) | JWT + role guard on every `/vendor/*` route; ownership checks per item and order |
| Privacy: collect only what's needed | Phone optional; vendors see phone numbers only for in-progress orders; reviews show first name + initial |
| Risk: missed orders (§2.9) | Orders pushed live to the board, badge, tab-title count, optional chime, highlighted new cards |
| Risk: busy pickup periods | 10-minute pickup slots with a per-shop cap; pause-orders switch |
| Evaluation: time to order, ease of use (§2.10) | Checkout time recorded per order, one-tap "how easy was it?" after ordering, live figures on `/about` |

### Design

Colour palette: `#4A4A4A` charcoal (text, primary actions, vendor sidebar), `#CBCBCB` silver (controls, empty states), `#FFFFE3` cream (background) and `#6D8196` slate (brand accent). Text and buttons use a slightly deeper slate (`#56697E`) where white-on-slate would fail WCAG AA contrast. Toasts use the usual green / red / amber / blue so their meaning is instant.

Human-centred choices:
- plain-language status explanations
- touch targets at least 44px
- AA contrast, and `prefers-reduced-motion` support
- first-visit guidance
- a reason required before cancelling
- the basket survives interruptions
- recovery when a pickup slot fills up

### Known limitations

- Mobile money is simulated. On the order page, **I've approved it** stands in for the MTN/Airtel payment callback.
- Logins are stored as a token in the browser's `localStorage`. A production build should use httpOnly cookies.
- `npm audit` reports issues in Prisma's own command-line tooling (`@prisma/config`). The fix is a major Prisma upgrade (v7), not done yet.
- The app is in English. Only seeded reviews and owner replies are in Kinyarwanda.
