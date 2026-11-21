import { Router } from "express";
import prisma from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/roleGuard.js";
import fs from "node:fs";
import { upload, fileUrl } from "../middleware/upload.js";
import { uniqueOrderCode, toInt, hhmm, evaluatePromo, recomputeRating, slotLoad } from "../utils/helpers.js";

const router = Router();
router.use(authenticate, requireRole("STUDENT"));

const PHONE_RE = /^07[2389]\d{7}$/;
const ACTIVE = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"];

const ORDER_INCLUDE = {
  vendor: { select: { id: true, shop_name: true, location: true, phone: true, image_url: true, cover_url: true } },
  items: { include: { menu_item: { select: { id: true, name: true, image_url: true } } } },
  review: { include: { photos: true } },
};

async function ownOrder(req) {
  const order = await prisma.order.findUnique({ where: { id: toInt(req.params.id) } });
  if (!order || order.student_id !== req.user.id) throw new AppError("Order not found", 404);
  return order;
}

// ── Promo preview ─────────────────────────────────────────
router.post("/promos/validate", async (req, res, next) => {
  try {
    const { vendor_id, code, subtotal } = req.body;
    if (!vendor_id || !code) throw new AppError("vendor_id and code are required", 400);
    const result = await evaluatePromo(Number(vendor_id), code, Number(subtotal) || 0);
    res.json({ code: result.code, percent_off: result.promo.percent_off, discount: result.discount });
  } catch (err) {
    next(err);
  }
});

// ── Orders ────────────────────────────────────────────────
router.post("/orders", async (req, res, next) => {
  try {
    const { vendor_id, pickup_time, note, items, promo_code, payment_method = "CASH", payment_phone, checkout_seconds } = req.body;

    if (!vendor_id || !pickup_time || !Array.isArray(items) || items.length === 0) {
      throw new AppError("vendor_id, pickup_time and at least one item are required", 400);
    }
    if (!["MOMO", "AIRTEL", "CASH"].includes(payment_method)) throw new AppError("Unknown payment method", 400);
    if (payment_method !== "CASH" && !PHONE_RE.test(String(payment_phone || "").replace(/\s/g, ""))) {
      throw new AppError("Enter a valid mobile money number, e.g. 0788123456", 400);
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: Number(vendor_id) } });
    if (!vendor) throw new AppError("Shop not found", 404);
    if (!vendor.is_open) throw new AppError(`${vendor.shop_name} isn't taking orders right now`, 400);

    const pickup = new Date(pickup_time);
    const earliest = Date.now() + (vendor.prep_minutes - 2) * 60_000;
    if (Number.isNaN(pickup.getTime()) || pickup.getTime() < earliest) {
      throw new AppError(`Pickup must be at least ${vendor.prep_minutes} minutes from now`, 400);
    }
    if (pickup.getTime() > Date.now() + 24 * 3600_000) throw new AppError("Pickup must be within the next 24 hours", 400);
    const mins = pickup.getHours() * 60 + pickup.getMinutes();
    if (mins < hhmm(vendor.opens_at) || mins > hhmm(vendor.closes_at)) {
      throw new AppError(`Pickup must be between ${vendor.opens_at} and ${vendor.closes_at}`, 400);
    }

    // merge duplicate lines
    const qty = new Map();
    for (const line of items) {
      const id = Number(line.menu_item_id);
      const q = Number(line.quantity);
      if (!id || !Number.isInteger(q) || q < 1) throw new AppError("Each item needs a menu_item_id and a quantity of at least 1", 400);
      qty.set(id, (qty.get(id) || 0) + q);
    }
    for (const q of qty.values()) if (q > 20) throw new AppError("Maximum 20 of any single item per order", 400);

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...qty.keys()] }, vendor_id: vendor.id, is_archived: false },
    });
    if (menuItems.length !== qty.size) throw new AppError("Some items are no longer on this menu", 400);
    const soldOut = menuItems.filter((m) => !m.is_available);
    if (soldOut.length) throw new AppError(`Sold out: ${soldOut.map((m) => m.name).join(", ")}`, 400);

    const lines = menuItems.map((m) => ({
      menu_item_id: m.id,
      quantity: qty.get(m.id),
      unit_price: m.price,
      subtotal: m.price * qty.get(m.id),
    }));
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const promo = promo_code ? await evaluatePromo(vendor.id, promo_code, subtotal) : null;
    const discount = promo?.discount || 0;

    // Serializable so two students can't both take the last place in a slot.
    const order = await prisma.$transaction(async (tx) => {
      if ((await slotLoad(vendor.id, pickup, tx)) >= vendor.slot_capacity) {
        throw new AppError("That pickup time just filled up. Please pick another slot.", 409);
      }
      if (promo) await tx.promo.update({ where: { id: promo.promo.id }, data: { used_count: { increment: 1 } } });
      return tx.order.create({
        data: {
          code: await uniqueOrderCode(tx),
          student_id: req.user.id,
          vendor_id: vendor.id,
          pickup_time: pickup,
          subtotal,
          discount,
          total_amount: subtotal - discount,
          promo_code: promo?.code || null,
          payment_method,
          payment_phone: payment_method === "CASH" ? null : String(payment_phone).replace(/\s/g, ""),
          note: note ? String(note).slice(0, 300) : null,
          checkout_seconds: Number.isInteger(checkout_seconds) && checkout_seconds > 0 && checkout_seconds < 7200 ? checkout_seconds : null,
          items: { create: lines },
        },
        include: ORDER_INCLUDE,
      });
    }, { isolationLevel: "Serializable" });

    res.status(201).json(order);
  } catch (err) {
    if (err?.code === "P2034") return next(new AppError("Lots of orders are coming in at once. Please try again.", 409));
    next(err);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    const where = { student_id: req.user.id };
    if (req.query.scope === "active") where.status = { in: ACTIVE };
    if (req.query.scope === "past") where.status = { in: ["COMPLETED", "CANCELLED"] };
    const orders = await prisma.order.findMany({ where, orderBy: { created_at: "desc" }, include: ORDER_INCLUDE });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: toInt(req.params.id) }, include: ORDER_INCLUDE });
    if (!order || order.student_id !== req.user.id) throw new AppError("Order not found", 404);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Simulated mobile-money confirmation (stands in for the MoMo/Airtel callback)
router.post("/orders/:id/pay", async (req, res, next) => {
  try {
    const order = await ownOrder(req);
    if (order.payment_method === "CASH") throw new AppError("This order is paid in cash at pickup", 400);
    if (order.status === "CANCELLED") throw new AppError("This order was cancelled", 400);
    if (order.payment_status === "PAID") throw new AppError("Already paid", 400);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { payment_status: "PAID" },
      include: ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// One-tap "how easy was ordering?" answer, used to evaluate usability (brief §2.10)
router.post("/orders/:id/ease", async (req, res, next) => {
  try {
    const order = await ownOrder(req);
    const rating = parseInt(req.body.rating);
    if (!(rating >= 1 && rating <= 5)) throw new AppError("Rating must be between 1 and 5", 400);
    await prisma.order.update({ where: { id: order.id }, data: { ease_rating: rating } });
    res.json({ ease_rating: rating });
  } catch (err) {
    next(err);
  }
});

router.post("/orders/:id/cancel", async (req, res, next) => {
  try {
    const order = await ownOrder(req);
    if (order.status !== "SUBMITTED") {
      throw new AppError("The kitchen has already accepted this order. Call the shop to cancel.", 400);
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (order.promo_code) {
        await tx.promo.updateMany({
          where: { vendor_id: order.vendor_id, code: order.promo_code, used_count: { gt: 0 } },
          data: { used_count: { decrement: 1 } },
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelled_by: "STUDENT",
          cancel_reason: req.body?.reason ? String(req.body.reason).slice(0, 200) : "Cancelled by customer",
          payment_status: order.payment_status === "PAID" ? "REFUNDED" : order.payment_status,
        },
        include: ORDER_INCLUDE,
      });
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/orders/:id/review", upload.array("photos", 4), async (req, res, next) => {
  try {
    const order = await ownOrder(req);
    if (order.status !== "COMPLETED") throw new AppError("You can review an order once you've picked it up", 400);
    const existing = await prisma.review.findUnique({ where: { order_id: order.id } });
    if (existing) throw new AppError("You've already reviewed this order", 409);

    const rating = parseInt(req.body.rating);
    if (!(rating >= 1 && rating <= 5)) throw new AppError("Rating must be between 1 and 5", 400);
    const comment = req.body.comment ? String(req.body.comment).replace(/[<>]/g, "").trim().slice(0, 1000) : null;

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          order_id: order.id,
          user_id: req.user.id,
          vendor_id: order.vendor_id,
          rating,
          comment: comment || null,
          photos: { create: (req.files || []).map((f) => ({ url: fileUrl(f) })) },
        },
        include: { photos: true },
      });
      await recomputeRating(order.vendor_id, tx);
      return r;
    });

    res.status(201).json(review);
  } catch (err) {
    for (const f of req.files || []) fs.unlink(f.path, () => {});
    next(err);
  }
});

// ── Favorites ─────────────────────────────────────────────
router.get("/favorites", async (req, res, next) => {
  try {
    const favs = await prisma.favorite.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: "desc" },
      include: {
        vendor: {
          select: {
            id: true, shop_name: true, cuisine: true, location: true, is_open: true, cover_url: true,
            image_url: true, rating_avg: true, rating_count: true, prep_minutes: true, opens_at: true, closes_at: true,
          },
        },
      },
    });
    res.json({ vendors: favs.map((f) => ({ ...f.vendor, is_favorite: true })) });
  } catch (err) {
    next(err);
  }
});

router.put("/favorites/:vendorId", async (req, res, next) => {
  try {
    const vendor_id = toInt(req.params.vendorId);
    await prisma.favorite.upsert({
      where: { user_id_vendor_id: { user_id: req.user.id, vendor_id } },
      create: { user_id: req.user.id, vendor_id },
      update: {},
    });
    res.json({ is_favorite: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/favorites/:vendorId", async (req, res, next) => {
  try {
    await prisma.favorite.deleteMany({ where: { user_id: req.user.id, vendor_id: toInt(req.params.vendorId) } });
    res.json({ is_favorite: false });
  } catch (err) {
    next(err);
  }
});

export default router;
