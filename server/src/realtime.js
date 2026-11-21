// Server-Sent Events hub: pushes order changes to the people involved the moment they happen.
// In-memory, so it assumes a single API process (fine for this prototype).
import { Router } from "express";
import { authenticate } from "./middleware/auth.js";

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

streamRouter.get("/stream", authenticate, (req, res) => {
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
  clients.get(uid).add(res);

  // keep proxies from closing an idle connection
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    clients.get(uid)?.delete(res);
    if (!clients.get(uid)?.size) clients.delete(uid);
  });
});
