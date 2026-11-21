import prisma from "./prisma.js";
import { AppError } from "./errors.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeOrderCode() {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `CB-${s}`;
}

export async function uniqueOrderCode(tx = prisma) {
  for (let i = 0; i < 8; i++) {
    const code = makeOrderCode();
    const exists = await tx.order.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new AppError("Could not generate order code", 500);
}

export async function requireVendor(userId) {
  const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } });
  if (!vendor) throw new AppError("Set up your shop first", 404);
  return vendor;
}

export async function recomputeRating(vendorId, tx = prisma) {
  const agg = await tx.review.aggregate({
    where: { vendor_id: vendorId },
    _avg: { rating: true },
    _count: true,
  });
  await tx.vendor.update({
    where: { id: vendorId },
    data: {
      rating_avg: Math.round((agg._avg.rating || 0) * 10) / 10,
      rating_count: agg._count,
    },
  });
}

export function toInt(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new AppError("Invalid id", 400);
  return n;
}

/** "HH:MM" -> minutes since midnight */
export function hhmm(s) {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isValidHHMM(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
}

/** Validates & computes discount for a promo code against a subtotal. */
export async function evaluatePromo(vendorId, rawCode, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const promo = await prisma.promo.findUnique({
    where: { vendor_id_code: { vendor_id: vendorId, code } },
  });
  if (!promo || !promo.is_active) throw new AppError("That code isn't valid for this shop", 400);
  if (promo.expires_at && promo.expires_at < new Date()) throw new AppError("That code has expired", 400);
  if (promo.max_uses != null && promo.used_count >= promo.max_uses) throw new AppError("That code has been fully used", 400);
  if (subtotal < promo.min_order) throw new AppError(`Spend at least ${promo.min_order} RWF to use ${code}`, 400);
  const discount = Math.floor((subtotal * promo.percent_off) / 100);
  return { promo, code, discount };
}

export const SLOT_MINUTES = 10;

/** Today's pickup slots for a vendor with live occupancy. */
export async function pickupSlots(vendor, now = new Date()) {
  const step = SLOT_MINUTES * 60000;
  const earliest = new Date(now.getTime() + vendor.prep_minutes * 60000);
  let t = new Date(Math.ceil(earliest.getTime() / step) * step);
  const close = hhmm(vendor.closes_at);
  const open = hhmm(vendor.opens_at);
  const times = [];
  while (times.length < 24 && t.getDate() === now.getDate()) {
    const m = t.getHours() * 60 + t.getMinutes();
    if (m > close) break;
    if (m >= open) times.push(new Date(t));
    t = new Date(t.getTime() + step);
  }
  if (!times.length) return [];
  const orders = await prisma.order.findMany({
    where: {
      vendor_id: vendor.id,
      status: { not: "CANCELLED" },
      pickup_time: { gte: times[0], lt: new Date(times[times.length - 1].getTime() + step) },
    },
    select: { pickup_time: true },
  });
  return times.map((time) => {
    const taken = orders.filter((o) => o.pickup_time >= time && o.pickup_time < new Date(time.getTime() + step)).length;
    return { time: time.toISOString(), taken, capacity: vendor.slot_capacity, full: taken >= vendor.slot_capacity };
  });
}

/** Number of non-cancelled orders already booked in the slot containing `pickup`. */
export async function slotLoad(vendorId, pickup, tx = prisma) {
  const step = SLOT_MINUTES * 60000;
  const start = new Date(Math.floor(pickup.getTime() / step) * step);
  return tx.order.count({
    where: { vendor_id: vendorId, status: { not: "CANCELLED" }, pickup_time: { gte: start, lt: new Date(start.getTime() + step) } },
  });
}
