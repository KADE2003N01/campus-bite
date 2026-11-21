// Server-Sent Events hub: pushes order changes to the people involved the moment they happen.
// In-memory, so it assumes a single API process (fine for this prototype).
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "./middleware/auth.js";

// Abuse limits: a few tabs per person, a ceiling for the whole server, and a cap on reconnect storms.
const MAX_PER_USER = 5;
const MAX_TOTAL = 2000;
let total = 0;

const connectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
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

streamRouter.get("/stream", connectLimiter, authenticate, (req, res) => {
  if (total >= MAX_TOTAL) {
    res.set("Retry-After", "30");
    return res.status(503).json({ error: "Live updates are busy, falling back to refresh" });
  }
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
  total++;

  // keep proxies from closing an idle connection
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    if (clients.get(uid)?.delete(res)) total--;
    else if (res.writableEnded) total--; // closed earlier as an "oldest" connection
    if (!clients.get(uid)?.size) clients.delete(uid);
  });
});
