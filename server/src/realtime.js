// Server-Sent Events hub: pushes order changes to the people involved the moment they happen.
// In-memory, so it assumes a single API process (fine for this prototype).
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "./middleware/auth.js";

// Abuse limits: a few tabs per person, a ceiling for the whole server, and a cap on reconnect storms.
const MAX_PER_USER = 5;
const MAX_PER_IP = 30; // a shared campus Wi-Fi address can still serve many students
const MAX_LIFETIME_MS = 60 * 60 * 1000; // recycle after an hour; the browser reconnects by itself
const perIp = new Map(); // ip -> open connection count

// Keyed by user (runs after authenticate), so people behind one NAT don't share a bucket.
const connectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { error: "Too many live connections opened, please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
});

const clients = new Map(); // userId -> Set<res>

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Push an event to every open connection of the given user ids. */
export function notify(userIds, event, data) {
  for (const id of new Set(userIds.filter(Boolean))) {
    for (const res of clients.get(id) || []) send(res, event, data);
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

streamRouter.get("/stream", authenticate, connectLimiter, (req, res) => {
  const ip = req.ip;
  if ((perIp.get(ip) || 0) >= MAX_PER_IP) {
    res.set("Retry-After", "30");
    return res.status(429).json({ error: "Too many live connections from this network, falling back to refresh" });
  }
  perIp.set(ip, (perIp.get(ip) || 0) + 1);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  send(res, "ready", { user_id: req.user.id });

  const uid = req.user.id;
  if (!clients.has(uid)) clients.set(uid, new Set());
  const mine = clients.get(uid);
  // Sets keep insertion order, so the first entry is the oldest connection
  while (mine.size >= MAX_PER_USER) {
    const oldest = mine.values().next().value;
    mine.delete(oldest);
    send(oldest, "replaced", {}); // tells that tab to stop reconnecting and fall back to polling
    oldest.end();
  }
  mine.add(res);

  // keep proxies from closing an idle connection
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  const lifetime = setTimeout(() => res.end(), MAX_LIFETIME_MS);
  req.on("close", () => {
    clearInterval(ping);
    clearTimeout(lifetime);
    clients.get(uid)?.delete(res);
    if (!clients.get(uid)?.size) clients.delete(uid);
    const n = (perIp.get(ip) || 1) - 1;
    n > 0 ? perIp.set(ip, n) : perIp.delete(ip);
  });
});
