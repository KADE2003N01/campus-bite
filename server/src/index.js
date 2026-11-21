import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import studentRoutes from "./routes/student.js";
import vendorRoutes from "./routes/vendor.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { sanitizeBody } from "./middleware/sanitize.js";
import { UPLOAD_DIR } from "./middleware/upload.js";
import { streamRouter } from "./realtime.js";

dotenv.config();
// Opening hours and pickup slots are local campus time.
process.env.TZ ||= "Africa/Kigali";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const app = express();
// Behind a reverse proxy (nginx, Render, etc.) set TRUST_PROXY=1 so req.ip is the real client address.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
const port = process.env.PORT || 3001;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeBody);

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts, please try again in a few minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generous: vendor boards and order trackers poll every few seconds.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/v1/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth", authRoutes);
// Long-lived push connection; not rate-limited per request
app.use("/api/v1", streamRouter);
app.use("/api/v1/vendor", apiLimiter, vendorRoutes);
app.use("/api/v1", apiLimiter, catalogRoutes);
// Student routes only see their own prefixes, so unknown paths 404 instead of 403.
app.use("/api/v1", apiLimiter, (req, res, next) => (/^\/(orders|favorites|promos)(\/|$)/.test(req.path) ? studentRoutes(req, res, next) : next()));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
