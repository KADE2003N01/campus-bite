function sanitizeValue(val) {
  if (typeof val === "string") {
    return val.replace(/[<>]/g, "").trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === "object") {
    return sanitizeObject(val);
  }
  return val;
}

// Passwords are hashed, never rendered, so they are left exactly as typed.
const RAW_KEYS = new Set(["password", "current_password", "new_password"]);

function sanitizeObject(obj) {
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    clean[key] = RAW_KEYS.has(key) ? val : sanitizeValue(val);
  }
  return clean;
}

export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
}
