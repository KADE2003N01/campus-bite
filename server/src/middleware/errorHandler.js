import multer from "multer";
import { AppError } from "../utils/errors.js";

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Images must be under 4 MB" : err.code === "LIMIT_FILE_COUNT" ? "Up to 4 photos per review" : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
