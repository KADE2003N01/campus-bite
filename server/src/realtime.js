// Server-Sent Events hub: pushes order changes to the people involved the moment they happen.
// In-memory, so it assumes a single API process (fine for this prototype).
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "./middleware/auth.js";

// ── Limits ─────────────────────────────────────────────────
// Each limit only ever affects the source that hit it: a user's 6th tab replaces that user's
// oldest tab, an address over its share replaces that address's oldest connection, and when the
// whole server is full new connections are refused (browsers fall back to periodic refresh).
const MAX_PER_USER = 5;
const MAX_PER_IP = 200; // generous: many students share one campus Wi-Fi address
const MAX_TOTAL = 10000; // well below typical file-descriptor limits
const MAX_LIFETIME_MS = 60 * 60 * 1000; // recycle hourly; the browser reconnects by itself

const byUser = new Map(); // userId -> Set<conn>   (Set keeps insertion order: oldest first)
const byIp = new Map(); // ip -> Set<conn>
let total = 0;

// Loose per-address throttle that only counts failed (unauthenticated) attempts.
const unauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

// Keyed by user (runs after authenticate), so people behind one NAT don't share a bucket.
const connectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { error: "Too many live connections opened, please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Connection bookkeeping ─────────────────────────────────
function write(conn, chunk) {
  if (conn.closed || conn.res.writableEnded || conn.res.destroyed) return;
  try {
    conn.res.write(chunk);
  } catch {
    release(conn);
  }
}

function send(conn, event, data) {
  write(conn, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function removeFrom(map, key, conn) {
  const set = map.get(key);
  if (!set) return;
  set.delete(conn);
  if (!set.size) map.delete(key);
}

/** Idempotent: unregisters the connection everywhere and ends the response. */
function release(conn, reason) {
  if (conn.closed) return;
  if (reason) send(conn, reason, {}); // e.g. "replaced": the tab stops reconnecting and polls instead
  conn.closed = true;
  clearInterval(conn.ping);
  clearTimeout(conn.lifetime);
  removeFrom(byUser, conn.uid, conn);
  removeFrom(byIp, conn.ip, conn);
  total--;
  if (!conn.res.writableEnded) conn.res.end();
}

function oldest(set) {
  for (const c of set || []) if (!c.closed) return c;
  return null;
}

/** Push an event to every open connection of the given user ids. */
export function notify(userIds, event, data) {
  for (const id of new Set(userIds.filter(Boolean))) {
    for (const conn of [...(byUser.get(id) || [])]) send(conn, event, data);
  }
}

/** Minimal order snapshot that is safe to broadcast to both sides. */
export function orderEvent(order) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    payment_status: order.payment_status,
    vendor_id: order.vendor_id,
    pickup_time: order.pickup_time,
    at: new Date().toISOString(),
  };
}

export const streamRouter = Router();

streamRouter.get("/stream", unauthLimiter, authenticate, connectLimiter, (req, res) => {
  const uid = req.user.id;
  const ip = req.ip;

  // Make room only from this user's / this address's own connections.
  while ((byUser.get(uid)?.size || 0) >= MAX_PER_USER) release(oldest(byUser.get(uid)), "replaced");
  while ((byIp.get(ip)?.size || 0) >= MAX_PER_IP) release(oldest(byIp.get(ip)), "replaced");

  if (total >= MAX_TOTAL) {
    res.set("Retry-After", "60");
    return res.status(503).json({ error: "Live updates are busy, falling back to refresh" });
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.on("error", () => {}); // a broken socket must never crash the process

  const conn = { uid, ip, res, closed: false };
  for (const [map, key] of [[byUser, uid], [byIp, ip]]) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(conn);
  }
  total++;

  write(conn, "retry: 3000\n\n");
  send(conn, "ready", { user_id: uid });

  conn.ping = setInterval(() => write(conn, ": ping\n\n"), 25000); // keeps proxies from closing idle streams
  conn.lifetime = setTimeout(() => release(conn), MAX_LIFETIME_MS);
  req.on("close", () => release(conn));
});
