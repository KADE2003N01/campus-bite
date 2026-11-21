/**
 * End-to-end API smoke test for CampusBite.
 *
 *   npm run test:smoke                      (API on http://localhost:3001)
 *   API_URL=http://localhost:3002 npm run test:smoke
 *
 * Needs the demo seed (npm run db:seed) and at least one shop that is open with
 * pickup slots left today. It creates real orders in the database.
 */
const API = (process.env.API_URL || "http://localhost:3001") + "/api/v1";
const PASSWORD = "password123";
const STUDENT = process.env.SMOKE_STUDENT || "grace@campusbite.test";
const VENDORS = ["marie", "jean", "aline", "patrick", "diane", "claude", "sandrine", "emmanuel", "olivier", "fiona"].map((n) => `${n}@campusbite.test`);

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };
function assert(cond, msg, detail) {
  if (!cond) {
    console.error(`  ✗ ${msg}${detail ? `\n    ${JSON.stringify(detail)}` : ""}`);
    process.exit(1);
  }
  ok(msg);
}

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers["content-type"] = "application/json";
  const res = await fetch(API + path, { method, headers, body: form || (body && JSON.stringify(body)) });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}
const login = async (email) => (await call("POST", "/auth/login", { body: { email, password: PASSWORD } })).data?.token;

// 1×1 transparent PNG used as a review photo
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

console.log(`\nCampusBite smoke test against ${API}\n`);

// ── Basics ──
const health = await call("GET", "/health").catch(() => ({ status: 0 }));
assert(health.status === 200, "API is reachable", health.status === 0 ? "Is the server running?" : health);

const vendors = await call("GET", "/vendors");
assert(vendors.status === 200 && vendors.data.vendors.length > 0, `catalog lists ${vendors.data?.vendors?.length} shops`);

const search = await call("GET", "/menu/search?q=chapati");
assert(search.status === 200, `price comparison search works (${search.data.items.length} chapati dishes)`);

const student = await login(STUDENT);
assert(student, `student logs in (${STUDENT})`);

// ── Find an open shop with pickup slots left, and log in as its owner ──
let vendorToken, shop, slots;
for (const email of VENDORS) {
  const t = await login(email);
  if (!t) continue;
  const profile = (await call("GET", "/vendor/profile", { token: t })).data?.vendor;
  if (!profile?.is_open) continue;
  const s = (await call("GET", `/vendors/${profile.id}/slots`)).data.slots.filter((x) => !x.full);
  if (s.length >= 2) { vendorToken = t; shop = profile; slots = s; break; }
}
if (!shop) {
  console.log("\n  No shop has pickup slots left right now (shops close between 18:00 and 22:00 Kigali time).");
  console.log("  Run the test during opening hours, or raise closes_at for a shop in Shop settings.\n");
  process.exit(2);
}
ok(`using ${shop.shop_name} (vendor logs in, ${slots.length} free pickup slots)`);

const menu = (await call("GET", `/vendors/${shop.id}`)).data.items.filter((i) => i.is_available);
const [a, b] = menu;

// ── Place, pay, prepare, complete ──
const order = await call("POST", "/orders", {
  token: student,
  body: {
    vendor_id: shop.id,
    pickup_time: slots[1].time,
    items: [{ menu_item_id: a.id, quantity: 2 }, { menu_item_id: b.id, quantity: 1 }],
    payment_method: "MOMO",
    payment_phone: "0788123456",
    checkout_seconds: 45,
    note: "Smoke test order",
  },
});
assert(order.status === 201, `student places an order (${order.data?.code})`, order.data);
assert(order.data.total_amount === a.price * 2 + b.price, "server calculates the total from current menu prices");
assert(order.data.status === "SUBMITTED" && order.data.payment_status === "PENDING", "order starts as Submitted, payment pending");

const paid = await call("POST", `/orders/${order.data.id}/pay`, { token: student });
assert(paid.data?.payment_status === "PAID", "mobile money payment is confirmed");

const board = await call("GET", "/vendor/orders?status=SUBMITTED&board=1", { token: vendorToken });
assert(board.data.some((o) => o.id === order.data.id), "vendor sees the new order on the live board");

const skip = await call("PATCH", `/vendor/orders/${order.data.id}/status`, { token: vendorToken, body: { status: "READY" } });
assert(skip.status === 400, "vendor can't skip steps (Submitted → Ready is rejected)");

for (const status of ["ACCEPTED", "PREPARING", "READY", "COMPLETED"]) {
  const r = await call("PATCH", `/vendor/orders/${order.data.id}/status`, { token: vendorToken, body: { status } });
  assert(r.data?.status === status, `vendor moves the order to ${status}`, r.data);
  const seen = await call("GET", `/orders/${order.data.id}`, { token: student });
  assert(seen.data.status === status, `  student sees ${status}`);
}

// ── Review with a photo ──
const form = new FormData();
form.append("rating", "5");
form.append("comment", "Smoke test: ibiryo biraryoshye cyane!");
form.append("photos", new Blob([PNG], { type: "image/png" }), "photo.png");
const review = await call("POST", `/orders/${order.data.id}/review`, { token: student, form });
assert(review.status === 201 && review.data.photos.length === 1, "student posts a review with a photo");
const dup = await call("POST", `/orders/${order.data.id}/review`, { token: student, form });
assert(dup.status === 409, "a second review for the same order is rejected");
const photo = await fetch(API.replace("/api/v1", "") + review.data.photos[0].url);
assert(photo.status === 200, "the uploaded photo is served");

const ease = await call("POST", `/orders/${order.data.id}/ease`, { token: student, body: { rating: 4 } });
assert(ease.status === 200, "ease-of-ordering answer is recorded");

// ── Cancellation & refunds ──
const second = await call("POST", "/orders", {
  token: student,
  body: { vendor_id: shop.id, pickup_time: slots[0].time, items: [{ menu_item_id: a.id, quantity: 1 }], payment_method: "AIRTEL", payment_phone: "0731234567" },
});
await call("POST", `/orders/${second.data.id}/pay`, { token: student });
const cancelled = await call("POST", `/orders/${second.data.id}/cancel`, { token: student, body: { reason: "Smoke test" } });
assert(cancelled.data?.status === "CANCELLED" && cancelled.data.payment_status === "REFUNDED", "student cancels before acceptance and is refunded");

// ── Guard rails ──
const badPhone = await call("POST", "/orders", { token: student, body: { vendor_id: shop.id, pickup_time: slots[0].time, items: [{ menu_item_id: a.id, quantity: 1 }], payment_method: "MOMO", payment_phone: "123" } });
assert(badPhone.status === 400, "invalid mobile money number is rejected");
const badPromo = await call("POST", "/promos/validate", { token: student, body: { vendor_id: shop.id, code: "NOT-A-CODE", subtotal: 5000 } });
assert(badPromo.status === 400, "unknown promo code is rejected");
const asVendor = await call("GET", "/orders", { token: vendorToken });
assert(asVendor.status === 403, "vendors can't use student endpoints");
const asStudent = await call("GET", "/vendor/orders", { token: student });
assert(asStudent.status === 403, "students can't use vendor endpoints");
const noAuth = await call("GET", "/orders");
assert(noAuth.status === 401, "endpoints require login");
const finished = await call("GET", "/vendor/orders?status=COMPLETED&take=5", { token: vendorToken });
assert(finished.data.every((o) => o.student.phone === null), "customer phone numbers are hidden on finished orders");

console.log(`\nAll ${passed} checks passed.\n`);
