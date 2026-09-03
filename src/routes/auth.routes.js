const { Router } = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken");
const authRequired = require("../middleware/auth.middleware");

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashed },
      select: { id: true, name: true, email: true }, // jangan return password
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Email or password is incorrect" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Email or password is incorrect" });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, isOnline: true, monitorToken: true },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user);
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logout successful" });
});

router.put("/profile", authRequired, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name },
      select: { id: true, name: true, email: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/password", authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });
    res.json({ message: "Password successfully changed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/regenerate-monitor-token", authRequired, async (req, res) => {
  try {
    const { randomUUID } = require("crypto");
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { monitorToken: randomUUID() },
      select: { monitorToken: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/status", authRequired, async (req, res) => {
  try {
    const { isOnline } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { isOnline: Boolean(isOnline) },
      select: { id: true, name: true, email: true, isOnline: true, monitorToken: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;