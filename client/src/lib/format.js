const rwfFmt = new Intl.NumberFormat("en-US");

export const rwf = (n) => `${rwfFmt.format(Math.round(n || 0))} RWF`;
export const num = (n) => rwfFmt.format(Math.round(n || 0));

export function clock(d) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function shortDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === y.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function when(d) {
  return `${dayLabel(d)}, ${clock(d)}`;
}

export function ago(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  if (days < 60) return `${Math.round(days / 7)} wk ago`;
  return shortDate(d);
}

/** Minutes from now until d (negative when past). */
export function minutesUntil(d) {
  return Math.round((new Date(d).getTime() - Date.now()) / 60000);
}

export function initials(name = "") {
  return name
    .replace(/[^A-Za-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Status names follow the project brief (§2.4); `help` tells the student what happens next.
export const STATUS = {
  SUBMITTED: { label: "Submitted", short: "New", tone: "honey", help: "Sent to the vendor. You can still cancel until they accept." },
  ACCEPTED: { label: "Accepted", short: "Accepted", tone: "sky", help: "The vendor has your order and will start it soon." },
  PREPARING: { label: "Preparing", short: "Preparing", tone: "plum", help: "Your food is being made now." },
  READY: { label: "Ready for pickup", short: "Ready", tone: "forest", help: "Go to the counter and show your pickup code." },
  COMPLETED: { label: "Completed", short: "Completed", tone: "muted", help: "Collected. Enjoy your meal." },
  CANCELLED: { label: "Cancelled", short: "Cancelled", tone: "chili", help: "This order won't be prepared." },
};

export const PAYMENT = {
  MOMO: "MTN MoMo",
  AIRTEL: "Airtel Money",
  CASH: "Cash at pickup",
};

/** Is the shop inside its posted hours right now? */
export function withinHours(v, at = new Date()) {
  const m = at.getHours() * 60 + at.getMinutes();
  const toM = (s) => {
    const [h, mm] = s.split(":").map(Number);
    return h * 60 + mm;
  };
  return m >= toM(v.opens_at) && m <= toM(v.closes_at);
}
