import { Router } from "express";
import prisma from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { optionalAuth } from "../middleware/auth.js";
import { toInt, pickupSlots } from "../utils/helpers.js";
import { serializeReview } from "../utils/format.js";

const router = Router();

const VENDOR_PUBLIC = {
  id: true,
  shop_name: true,
  description: true,
  cuisine: true,
  location: true,
  phone: true,
  is_open: true,
  image_url: true,
  cover_url: true,
  opens_at: true,
  closes_at: true,
  prep_minutes: true,
  rating_avg: true,
  rating_count: true,
};

async function favoriteIds(req) {
  if (req.user?.role !== "STUDENT") return new Set();
  const favs = await prisma.favorite.findMany({ where: { user_id: req.user.id }, select: { vendor_id: true } });
  return new Set(favs.map((f) => f.vendor_id));
}

/** Units sold per menu item over the last N days (non-cancelled orders). */
async function soldCounts(where = {}, days = 30) {
  const since = new Date(Date.now() - days * 864e5);
  const rows = await prisma.orderItem.groupBy({
    by: ["menu_item_id"],
    where: { ...where, order: { status: { not: "CANCELLED" }, created_at: { gte: since } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.menu_item_id, r._sum.quantity || 0]));
}

// GET /vendors?q=&cuisine=&sort=rating|name|prep&open=1
router.get("/vendors", optionalAuth, async (req, res, next) => {
  try {
    const { q, cuisine, sort, open } = req.query;
    const where = {};
    if (q) {
      where.OR = [
        { shop_name: { contains: q, mode: "insensitive" } },
        { cuisine: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ];
    }
    if (cuisine) where.cuisine = { equals: cuisine, mode: "insensitive" };
    if (open === "1") where.is_open = true;

    const orderBy =
      sort === "name" ? [{ shop_name: "asc" }]
      : sort === "prep" ? [{ prep_minutes: "asc" }]
      : [{ is_open: "desc" }, { rating_avg: "desc" }, { rating_count: "desc" }];

    const [vendors, stats, favs] = await Promise.all([
      prisma.vendor.findMany({ where, select: VENDOR_PUBLIC, orderBy }),
      prisma.menuItem.groupBy({
        by: ["vendor_id"],
        where: { is_archived: false, is_available: true },
        _count: true,
        _min: { price: true },
      }),
      favoriteIds(req),
    ]);
    const statMap = new Map(stats.map((s) => [s.vendor_id, s]));

    res.json({
      vendors: vendors.map((v) => ({
        ...v,
        item_count: statMap.get(v.id)?._count || 0,
        price_from: statMap.get(v.id)?._min.price || null,
        is_favorite: favs.has(v.id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/vendors/:id", optionalAuth, async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const vendor = await prisma.vendor.findUnique({ where: { id }, select: VENDOR_PUBLIC });
    if (!vendor) throw new AppError("Shop not found", 404);

    const [items, sold, favs] = await Promise.all([
      prisma.menuItem.findMany({
        where: { vendor_id: id, is_archived: false },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      soldCounts({ menu_item: { vendor_id: id } }),
      favoriteIds(req),
    ]);

    const ranked = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n >= 3);
    const popular = new Set(ranked.map(([mid]) => mid));

    res.json({
      vendor: { ...vendor, is_favorite: favs.has(id) },
      items: items.map((i) => ({ ...i, sold_30d: sold.get(i.id) || 0, is_popular: popular.has(i.id) })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/vendors/:id/slots", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: toInt(req.params.id) } });
    if (!vendor) throw new AppError("Shop not found", 404);
    res.json({ slots: vendor.is_open ? await pickupSlots(vendor) : [], slot_minutes: 10 });
  } catch (err) {
    next(err);
  }
});

// Aggregate usability metrics for evaluating the prototype (brief §2.10). No personal data.
router.get("/insights", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 864e5);
    const [completed, cancelled, timed, ease, vendors, reviews] = await Promise.all([
      prisma.order.count({ where: { status: "COMPLETED", created_at: { gte: since } } }),
      prisma.order.count({ where: { status: "CANCELLED", created_at: { gte: since } } }),
      prisma.order.findMany({ where: { checkout_seconds: { not: null } }, select: { checkout_seconds: true }, orderBy: { checkout_seconds: "asc" } }),
      prisma.order.groupBy({ by: ["ease_rating"], where: { ease_rating: { not: null } }, _count: true }),
      prisma.vendor.count(),
      prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
    ]);
    const secs = timed.map((t) => t.checkout_seconds);
    const median = secs.length ? secs[Math.floor(secs.length / 2)] : null;
    const easeCount = ease.reduce((s, e) => s + e._count, 0);
    const easeAvg = easeCount ? ease.reduce((s, e) => s + e.ease_rating * e._count, 0) / easeCount : null;
    const easy = ease.filter((e) => e.ease_rating >= 4).reduce((s, e) => s + e._count, 0);
    res.json({
      last30: { completed, cancelled, completion_rate: completed + cancelled ? Math.round((completed / (completed + cancelled)) * 100) : null },
      checkout: { median_seconds: median, samples: secs.length, under_60s: secs.length ? Math.round((secs.filter((s) => s <= 60).length / secs.length) * 100) : null },
      ease: { average: easeAvg && Math.round(easeAvg * 10) / 10, responses: easeCount, found_it_easy: easeCount ? Math.round((easy / easeCount) * 100) : null },
      vendors,
      reviews: { average: Math.round((reviews._avg.rating || 0) * 10) / 10, count: reviews._count },
    });
  } catch (err) {
    next(err);
  }
});

// GET /vendors/:id/reviews?rating=5&photos=1&take=20&skip=0
router.get("/vendors/:id/reviews", async (req, res, next) => {
  try {
    const vendorId = toInt(req.params.id);
    const take = Math.min(parseInt(req.query.take) || 20, 50);
    const skip = parseInt(req.query.skip) || 0;
    const where = { vendor_id: vendorId };
    if (req.query.rating) where.rating = toInt(req.query.rating);
    if (req.query.photos === "1") where.photos = { some: {} };

    const [reviews, total, dist, photos] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { created_at: "desc" },
        take,
        skip,
        include: {
          user: { select: { name: true } },
          photos: true,
          order: { select: { code: true, items: { select: { menu_item: { select: { name: true } } } } } },
        },
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({ by: ["rating"], where: { vendor_id: vendorId }, _count: true }),
      prisma.reviewPhoto.findMany({
        where: { review: { vendor_id: vendorId } },
        orderBy: { id: "desc" },
        take: 12,
        select: { id: true, url: true, review_id: true },
      }),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0;
    let sum = 0;
    for (const d of dist) {
      distribution[d.rating] = d._count;
      count += d._count;
      sum += d.rating * d._count;
    }

    res.json({
      reviews: reviews.map(serializeReview),
      total,
      summary: { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution },
      photos,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/menu/search", async (req, res, next) => {
  try {
    const { q, category, max } = req.query;
    if (!q && !category) return res.json({ items: [] });

    const AND = [{ is_available: true }, { is_archived: false }];
    if (q) {
      const search = String(q).trim();
      AND.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (category) AND.push({ category: { equals: category, mode: "insensitive" } });
    if (max) AND.push({ price: { lte: parseInt(max) || 0 } });

    const items = await prisma.menuItem.findMany({
      where: { AND },
      include: {
        vendor: { select: { id: true, shop_name: true, location: true, is_open: true, rating_avg: true, rating_count: true, prep_minutes: true } },
      },
      orderBy: { price: "asc" },
      take: 100,
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get("/menu/categories", async (req, res, next) => {
  try {
    const rows = await prisma.menuItem.groupBy({
      by: ["category"],
      where: { is_archived: false, category: { not: null } },
      _count: true,
      orderBy: { _count: { category: "desc" } },
    });
    res.json({ categories: rows.map((r) => ({ name: r.category, count: r._count })) });
  } catch (err) {
    next(err);
  }
});

router.get("/menu/popular", async (req, res, next) => {
  try {
    const sold = await soldCounts({ menu_item: { is_available: true, is_archived: false } }, 14);
    const top = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const items = await prisma.menuItem.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      include: { vendor: { select: { id: true, shop_name: true, is_open: true, rating_avg: true } } },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    res.json({
      items: top
        .map(([id, n]) => byId.get(id) && { ...byId.get(id), sold_14d: n })
        .filter(Boolean)
        .sort((a, b) => Number(b.vendor.is_open) - Number(a.vendor.is_open))
        .slice(0, 8),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
