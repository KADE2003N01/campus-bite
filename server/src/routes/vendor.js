import { Router } from "express";
import prisma from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/roleGuard.js";
import { upload, fileUrl } from "../middleware/upload.js";
import { requireVendor, toInt, isValidHHMM } from "../utils/helpers.js";
import { serializeReview } from "../utils/format.js";
import { notify, orderEvent } from "../realtime.js";

const router = Router();
router.use(authenticate, requireRole("VENDOR"));

// ── Shop profile ──────────────────────────────────────────
function profileData(body, { partial = false } = {}) {
  const { shop_name, description, cuisine, location, phone, opens_at, closes_at, prep_minutes, slot_capacity } = body;
  if (!partial && (!shop_name || !location || !phone)) throw new AppError("Shop name, location and phone are required", 400);
  const data = {};
  if (shop_name !== undefined) data.shop_name = String(shop_name).slice(0, 80);
  if (description !== undefined) data.description = description ? String(description).slice(0, 500) : null;
  if (cuisine !== undefined) data.cuisine = cuisine ? String(cuisine).slice(0, 40) : null;
  if (location !== undefined) data.location = String(location).slice(0, 120);
  if (phone !== undefined) data.phone = String(phone).slice(0, 20);
  if (opens_at !== undefined) {
    if (!isValidHHMM(opens_at)) throw new AppError("Opening time must look like 07:30", 400);
    data.opens_at = opens_at;
  }
  if (closes_at !== undefined) {
    if (!isValidHHMM(closes_at)) throw new AppError("Closing time must look like 20:00", 400);
    data.closes_at = closes_at;
  }
  if (data.opens_at && data.closes_at && data.opens_at >= data.closes_at) throw new AppError("Closing time must be after opening time", 400);
  if (prep_minutes !== undefined) {
    const p = parseInt(prep_minutes);
    if (!(p >= 5 && p <= 120)) throw new AppError("Prep time must be between 5 and 120 minutes", 400);
    data.prep_minutes = p;
  }
  if (slot_capacity !== undefined) {
    const c = parseInt(slot_capacity);
    if (!(c >= 1 && c <= 50)) throw new AppError("Orders per pickup slot must be between 1 and 50", 400);
    data.slot_capacity = c;
  }
  return data;
}

router.get("/profile", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
});

router.post("/profile", async (req, res, next) => {
  try {
    const existing = await prisma.vendor.findUnique({ where: { user_id: req.user.id } });
    if (existing) throw new AppError("Your shop is already set up", 409);
    const vendor = await prisma.vendor.create({ data: { user_id: req.user.id, ...profileData(req.body) } });
    res.status(201).json({ vendor });
  } catch (err) {
    next(err);
  }
});

router.put("/profile", async (req, res, next) => {
  try {
    await requireVendor(req.user.id);
    const vendor = await prisma.vendor.update({ where: { user_id: req.user.id }, data: profileData(req.body, { partial: true }) });
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
});

router.post("/profile/images", upload.fields([{ name: "cover", maxCount: 1 }, { name: "logo", maxCount: 1 }]), async (req, res, next) => {
  try {
    await requireVendor(req.user.id);
    const data = {};
    if (req.files?.cover?.[0]) data.cover_url = fileUrl(req.files.cover[0]);
    if (req.files?.logo?.[0]) data.image_url = fileUrl(req.files.logo[0]);
    if (!Object.keys(data).length) throw new AppError("Choose an image to upload", 400);
    const vendor = await prisma.vendor.update({ where: { user_id: req.user.id }, data });
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
});

router.patch("/status", async (req, res, next) => {
  try {
    const existing = await requireVendor(req.user.id);
    const vendor = await prisma.vendor.update({ where: { id: existing.id }, data: { is_open: !existing.is_open } });
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
});

// ── Menu ──────────────────────────────────────────────────
function menuData(body) {
  const { name, description, category } = body;
  const price = Number(body.price);
  if (!name || !String(name).trim()) throw new AppError("Item name is required", 400);
  if (!Number.isInteger(price) || price <= 0) throw new AppError("Price must be a whole number of RWF above 0", 400);
  return {
    name: String(name).replace(/[<>]/g, "").trim().slice(0, 80),
    description: description ? String(description).replace(/[<>]/g, "").trim().slice(0, 300) : null,
    category: category ? String(category).replace(/[<>]/g, "").trim().slice(0, 30) : null,
    price,
  };
}

async function ownItem(req, vendor) {
  const item = await prisma.menuItem.findUnique({ where: { id: toInt(req.params.id) } });
  if (!item || item.vendor_id !== vendor.id || item.is_archived) throw new AppError("Menu item not found", 404);
  return item;
}

router.get("/menu", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const since = new Date(Date.now() - 30 * 864e5);
    const [items, sold] = await Promise.all([
      prisma.menuItem.findMany({ where: { vendor_id: vendor.id, is_archived: false }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.orderItem.groupBy({
        by: ["menu_item_id"],
        where: { menu_item: { vendor_id: vendor.id }, order: { status: { not: "CANCELLED" }, created_at: { gte: since } } },
        _sum: { quantity: true, subtotal: true },
      }),
    ]);
    const map = new Map(sold.map((s) => [s.menu_item_id, s._sum]));
    res.json({
      items: items.map((i) => ({ ...i, sold_30d: map.get(i.id)?.quantity || 0, revenue_30d: map.get(i.id)?.subtotal || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/menu", upload.single("image"), async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const data = menuData(req.body);
    if (req.file) data.image_url = fileUrl(req.file);
    else if (req.body.image_url && /^https?:\/\//.test(req.body.image_url)) data.image_url = req.body.image_url;
    const item = await prisma.menuItem.create({ data: { ...data, vendor_id: vendor.id } });
    res.status(201).json({ item: { ...item, sold_30d: 0, revenue_30d: 0 } });
  } catch (err) {
    next(err);
  }
});

router.put("/menu/:id", upload.single("image"), async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const existing = await ownItem(req, vendor);
    const data = menuData(req.body);
    if (req.file) data.image_url = fileUrl(req.file);
    else if (req.body.remove_image === "1") data.image_url = null;
    const item = await prisma.menuItem.update({ where: { id: existing.id }, data });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.patch("/menu/:id/availability", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const existing = await ownItem(req, vendor);
    const item = await prisma.menuItem.update({ where: { id: existing.id }, data: { is_available: !existing.is_available } });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// Archive rather than hard-delete so past orders keep their line items.
router.delete("/menu/:id", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const existing = await ownItem(req, vendor);
    await prisma.menuItem.update({ where: { id: existing.id }, data: { is_archived: true, is_available: false } });
    res.json({ message: "Item removed from menu" });
  } catch (err) {
    next(err);
  }
});

// ── Orders ────────────────────────────────────────────────
const TRANSITIONS = {
  SUBMITTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
};

const VENDOR_ORDER_INCLUDE = {
  student: { select: { name: true, phone: true } },
  items: { include: { menu_item: { select: { name: true, image_url: true } } } },
  review: { select: { rating: true } },
};

// Privacy (brief §2.5.2): vendors only need a customer's number while an order is in progress.
function redactFinished(o) {
  if (!["COMPLETED", "CANCELLED"].includes(o.status)) return o;
  return { ...o, payment_phone: null, student: o.student ? { ...o.student, phone: null } : o.student };
}

router.get("/orders", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const where = { vendor_id: vendor.id };
    if (req.query.status) {
      where.status = { in: String(req.query.status).split(",").map((s) => s.trim().toUpperCase()) };
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      where.OR = [{ code: { contains: q, mode: "insensitive" } }, { student: { name: { contains: q, mode: "insensitive" } } }];
    }
    if (req.query.days) where.created_at = { gte: new Date(Date.now() - parseInt(req.query.days) * 864e5) };
    const take = Math.min(parseInt(req.query.take) || 200, 500);
    const orders = await prisma.order.findMany({
      where,
      orderBy: req.query.board === "1" ? { pickup_time: "asc" } : { created_at: "desc" },
      take,
      include: VENDOR_ORDER_INCLUDE,
    });
    res.json(orders.map(redactFinished));
  } catch (err) {
    next(err);
  }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const { status, reason } = req.body;
    if (!status) throw new AppError("status is required", 400);

    const order = await prisma.order.findUnique({ where: { id: toInt(req.params.id) } });
    if (!order || order.vendor_id !== vendor.id) throw new AppError("Order not found", 404);

    const allowed = TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(status)) throw new AppError(`Can't move an order from ${order.status} to ${status}`, 400);

    const data = { status };
    const now = new Date();
    if (status === "ACCEPTED") data.accepted_at = now;
    if (status === "READY") data.ready_at = now;
    if (status === "COMPLETED") {
      data.completed_at = now;
      if (order.payment_method === "CASH") data.payment_status = "PAID";
    }
    if (status === "CANCELLED") {
      if (!reason) throw new AppError("Tell the customer why you're cancelling", 400);
      data.cancel_reason = String(reason).slice(0, 200);
      data.cancelled_by = "VENDOR";
      if (order.payment_status === "PAID") data.payment_status = "REFUNDED";
    }

    // Conditional write: fails if the student cancelled/paid (or another tab moved it) since we read it
    const changed = await prisma.order.updateMany({
      where: { id: order.id, vendor_id: vendor.id, status: order.status, payment_status: order.payment_status },
      data,
    });
    if (changed.count !== 1) throw new AppError("This order just changed. The board has been refreshed.", 409);
    const updated = await prisma.order.findUnique({ where: { id: order.id }, include: VENDOR_ORDER_INCLUDE });
    notify([order.student_id, req.user.id], "order.updated", orderEvent(updated));
    res.json(redactFinished(updated));
  } catch (err) {
    next(err);
  }
});

// Counts for the sidebar badges (polled often, so kept cheap)
router.get("/badges", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const [new_orders, unreplied] = await Promise.all([
      prisma.order.count({ where: { vendor_id: vendor.id, status: "SUBMITTED" } }),
      prisma.review.count({ where: { vendor_id: vendor.id, vendor_reply: null } }),
    ]);
    res.json({ new_orders, unreplied });
  } catch (err) {
    next(err);
  }
});

// ── Analytics ─────────────────────────────────────────────
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

router.get("/stats", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const since = new Date(startToday.getTime() - 29 * 864e5);

    const [orders, unreplied, queue] = await Promise.all([
      prisma.order.findMany({
        where: { vendor_id: vendor.id, created_at: { gte: since } },
        select: {
          status: true, total_amount: true, created_at: true, accepted_at: true, ready_at: true, student_id: true, pickup_time: true,
          items: { select: { quantity: true, subtotal: true, menu_item: { select: { id: true, name: true, image_url: true } } } },
        },
      }),
      prisma.review.count({ where: { vendor_id: vendor.id, vendor_reply: null } }),
      prisma.order.groupBy({
        by: ["status"],
        where: { vendor_id: vendor.id, status: { in: ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"] } },
        _count: true,
      }),
    ]);

    const valid = orders.filter((o) => o.status !== "CANCELLED");
    const startYesterday = new Date(startToday.getTime() - 864e5);
    const sum = (list) => list.reduce((s, o) => s + o.total_amount, 0);
    const today = valid.filter((o) => o.created_at >= startToday);
    const yesterday = valid.filter((o) => o.created_at >= startYesterday && o.created_at < startToday);

    // 14-day series
    const series = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startToday.getTime() - i * 864e5);
      series.push({ date: dayKey(d), revenue: 0, orders: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.date, i]));
    for (const o of valid) {
      const i = idx.get(dayKey(o.created_at));
      if (i !== undefined) {
        series[i].revenue += o.total_amount;
        series[i].orders += 1;
      }
    }

    // top items
    const itemMap = new Map();
    for (const o of valid) {
      for (const li of o.items) {
        const cur = itemMap.get(li.menu_item.id) || { ...li.menu_item, qty: 0, revenue: 0 };
        cur.qty += li.quantity;
        cur.revenue += li.subtotal;
        itemMap.set(li.menu_item.id, cur);
      }
    }
    const top_items = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // prep time & busy hours
    const prepped = valid.filter((o) => o.accepted_at && o.ready_at);
    const avg_prep_minutes = prepped.length
      ? Math.round(prepped.reduce((s, o) => s + (o.ready_at - o.accepted_at), 0) / prepped.length / 60000)
      : null;
    const hours = Array.from({ length: 24 }, () => 0);
    for (const o of valid) hours[new Date(o.pickup_time).getHours()] += 1;

    const custCounts = new Map();
    for (const o of valid) custCounts.set(o.student_id, (custCounts.get(o.student_id) || 0) + 1);
    const repeat = [...custCounts.values()].filter((n) => n > 1).length;

    res.json({
      today: { revenue: sum(today), orders: today.length, avg_order: today.length ? Math.round(sum(today) / today.length) : 0 },
      yesterday: { revenue: sum(yesterday), orders: yesterday.length },
      last30: {
        revenue: sum(valid),
        orders: valid.length,
        cancelled: orders.length - valid.length,
        cancel_rate: orders.length ? Math.round(((orders.length - valid.length) / orders.length) * 100) : 0,
        customers: custCounts.size,
        repeat_customers: repeat,
      },
      queue: Object.fromEntries(queue.map((q) => [q.status, q._count])),
      series,
      top_items,
      avg_prep_minutes,
      busy_hours: hours,
      rating: { average: vendor.rating_avg, count: vendor.rating_count, unreplied },
    });
  } catch (err) {
    next(err);
  }
});

// ── Reviews ───────────────────────────────────────────────
router.get("/reviews", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const where = { vendor_id: vendor.id };
    if (req.query.filter === "unreplied") where.vendor_reply = null;
    if (req.query.filter === "photos") where.photos = { some: {} };
    if (req.query.filter === "low") where.rating = { lte: 3 };
    const reviews = await prisma.review.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        user: { select: { name: true } },
        photos: true,
        order: { select: { code: true, items: { select: { menu_item: { select: { name: true } } } } } },
      },
    });
    res.json({ reviews: reviews.map(serializeReview) });
  } catch (err) {
    next(err);
  }
});

router.put("/reviews/:id/reply", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const review = await prisma.review.findUnique({ where: { id: toInt(req.params.id) } });
    if (!review || review.vendor_id !== vendor.id) throw new AppError("Review not found", 404);
    const reply = String(req.body.reply || "").trim().slice(0, 600);
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { vendor_reply: reply || null, replied_at: reply ? new Date() : null },
      include: {
        user: { select: { name: true } },
        photos: true,
        order: { select: { code: true, items: { select: { menu_item: { select: { name: true } } } } } },
      },
    });
    res.json({ review: serializeReview(updated) });
  } catch (err) {
    next(err);
  }
});

// ── Promotions ────────────────────────────────────────────
router.get("/promos", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const promos = await prisma.promo.findMany({ where: { vendor_id: vendor.id }, orderBy: { created_at: "desc" } });
    const discounts = await prisma.order.groupBy({
      by: ["promo_code"],
      where: { vendor_id: vendor.id, promo_code: { not: null }, status: { not: "CANCELLED" } },
      _sum: { discount: true, total_amount: true },
    });
    const map = new Map(discounts.map((d) => [d.promo_code, d._sum]));
    res.json({
      promos: promos.map((p) => ({ ...p, discount_given: map.get(p.code)?.discount || 0, sales: map.get(p.code)?.total_amount || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/promos", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const code = String(req.body.code || "").trim().toUpperCase();
    const percent_off = parseInt(req.body.percent_off);
    if (!/^[A-Z0-9]{3,16}$/.test(code)) throw new AppError("Codes are 3–16 letters or numbers", 400);
    if (!(percent_off >= 1 && percent_off <= 90)) throw new AppError("Discount must be between 1% and 90%", 400);
    const exists = await prisma.promo.findUnique({ where: { vendor_id_code: { vendor_id: vendor.id, code } } });
    if (exists) throw new AppError("You already have a code with that name", 409);
    const promo = await prisma.promo.create({
      data: {
        vendor_id: vendor.id,
        code,
        percent_off,
        min_order: Math.max(0, parseInt(req.body.min_order) || 0),
        max_uses: req.body.max_uses ? Math.max(1, parseInt(req.body.max_uses)) : null,
        expires_at: req.body.expires_at ? new Date(req.body.expires_at) : null,
      },
    });
    res.status(201).json({ promo: { ...promo, discount_given: 0, sales: 0 } });
  } catch (err) {
    next(err);
  }
});

router.patch("/promos/:id", async (req, res, next) => {
  try {
    const vendor = await requireVendor(req.user.id);
    const promo = await prisma.promo.findUnique({ where: { id: toInt(req.params.id) } });
    if (!promo || promo.vendor_id !== vendor.id) throw new AppError("Promo not found", 404);
    const updated = await prisma.promo.update({ where: { id: promo.id }, data: { is_active: !promo.is_active } });
    res.json({ promo: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
