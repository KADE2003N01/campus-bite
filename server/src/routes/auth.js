import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const USER_SELECT = { id: true, name: true, email: true, phone: true, role: true, created_at: true };

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!name || !email || !password || !role) {
      throw new AppError("All fields are required", 400);
    }

    if (!["STUDENT", "VENDOR"].includes(role)) {
      throw new AppError("Role must be STUDENT or VENDOR", 400);
    }

    if (password.length < 6) {
      throw new AppError("Password must be at least 6 characters", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AppError("Enter a valid email address", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      throw new AppError("Email already registered", 409);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name: String(name).slice(0, 80), email: cleanEmail, phone: phone || null, password_hash, role },
      select: USER_SELECT,
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch("/me", authenticate, async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name || !String(name).trim()) throw new AppError("Name is required", 400);
    if (phone && !/^07\d{8}$/.test(String(phone).replace(/\s/g, ""))) throw new AppError("Phone should look like 0788123456", 400);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: String(name).trim().slice(0, 80), phone: phone ? String(phone).replace(/\s/g, "") : null },
      select: USER_SELECT,
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/me/password", authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) throw new AppError("New password must be at least 6 characters", 400);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(current_password || "", user.password_hash))) {
      throw new AppError("Current password is incorrect", 400);
    }
    await prisma.user.update({ where: { id: user.id }, data: { password_hash: await bcrypt.hash(new_password, 10) } });
    res.json({ message: "Password updated" });
  } catch (err) {
    next(err);
  }
});

export default router;
