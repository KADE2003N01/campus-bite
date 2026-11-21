import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { AppError } from "../utils/errors.js";

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ALLOWED[file.mimetype]}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new AppError("Only JPG, PNG or WebP images are allowed", 400));
    cb(null, true);
  },
});

export const fileUrl = (file) => `/uploads/${file.filename}`;
