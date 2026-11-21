import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors.js";

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) return next(new AppError("Authentication required", 401));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}

/** Attaches req.user when a valid token is present, but never rejects. */
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      /* ignore */
    }
  }
  next();
}
