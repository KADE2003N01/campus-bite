// Live order updates over Server-Sent Events.
// Uses fetch (not EventSource) so the login token travels in the Authorization header, never in the URL.
import { ref } from "vue";

const connected = ref(false);
const listeners = new Map(); // event name -> Set<fn>
let controller = null;
let retryTimer = null;
let attempt = 0;
let currentToken = null;

function emit(event, data) {
  for (const fn of listeners.get(event) || []) {
    try {
      fn(data);
    } catch (e) {
      console.error(e);
    }
  }
}

function parse(chunk) {
  let event = "message";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    emit(event, JSON.parse(data));
  } catch {
    /* ignore malformed frames */
  }
}

async function open(token) {
  controller = new AbortController();
  try {
    const res = await fetch("/api/v1/stream", {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (res.status === 401) return stop(); // logged out / expired; don't hammer the server
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    connected.value = true;
    const wasReconnect = attempt > 0;
    attempt = 0;
    if (wasReconnect) emit("reconnected", {}); // screens refetch anything missed while offline
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let i;
      while ((i = buffer.indexOf("\n\n")) >= 0) {
        parse(buffer.slice(0, i));
        buffer = buffer.slice(i + 2);
      }
    }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  connected.value = false;
  if (currentToken) {
    attempt++;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
    retryTimer = setTimeout(() => currentToken && open(currentToken), delay);
  }
}

export function start(token) {
  if (!token || token === currentToken) return;
  stop();
  currentToken = token;
  attempt = 0;
  open(token);
}

export function stop() {
  currentToken = null;
  clearTimeout(retryTimer);
  controller?.abort();
  controller = null;
  connected.value = false;
}

/** Subscribe to an event; returns an unsubscribe function. */
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function useRealtime() {
  return { connected, on, start, stop };
}
