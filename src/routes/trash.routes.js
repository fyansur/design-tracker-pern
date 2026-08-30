const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");

const router = Router();
router.use(authRequired);

// map "type" di URL ke Prisma model accessor + nama tabel asli di Postgres
// (nama tabel = nama model persis, karena kita gak pakai @@map)
const TYPES = {
  owner: { model: "owner", table: "Owner", scoped: false },      // Owner gak terikat userId (sama kayak skema asli)
  store: { model: "store", table: "Store", scoped: true },
  category: { model: "category", table: "Category", scoped: false },
  design: { model: "design", table: "Design", scoped: true },
  goal: { model: "goal", table: "Goal", scoped: true },
  "daily-goal": { model: "dailyGoal", table: "DailyGoal", scoped: true },
};

router.get("/", async (req, res) => {
  const type = TYPES[req.query.type];
  if (!type) return res.status(400).json({ message: "type tidak valid" });

  const items = await prisma[type.model].findMany({
    where: {
      deletedAt: { not: null }, // ini yang bikin extension nge-return yang soft-deleted, bukan di-exclude
      ...(type.scoped ? { userId: req.userId } : {}),
    },
    orderBy: { deletedAt: "desc" },
  });
  res.json(items);
});

router.post("/:type/:id/restore", async (req, res) => {
  const type = TYPES[req.params.type];
  if (!type) return res.status(400).json({ message: "type tidak valid" });

  const item = await prisma[type.model].findFirst({
    where: {
      id: Number(req.params.id),
      deletedAt: { not: null },
      ...(type.scoped ? { userId: req.userId } : {}),
    },
  });
  if (!item) return res.status(404).json({ message: "Item tidak ditemukan di trash" });

  const restored = await prisma[type.model].update({
    where: { id: item.id },
    data: { deletedAt: null },
  });
  res.json(restored);
});

router.delete("/:type/:id", async (req, res) => {
  const type = TYPES[req.params.type];
  if (!type) return res.status(400).json({ message: "type tidak valid" });

  const item = await prisma[type.model].findFirst({
    where: {
      id: Number(req.params.id),
      deletedAt: { not: null },
      ...(type.scoped ? { userId: req.userId } : {}),
    },
  });
  if (!item) return res.status(404).json({ message: "Item tidak ditemukan di trash" });

  // Hard delete beneran — library soft-delete gak bisa dipakai buat ini,
  // jadi turun ke raw SQL. AMAN karena `type.table` cuma bisa dari daftar
  // TYPES di atas (fixed), gak pernah langsung dari input user.
  await prisma.$executeRawUnsafe(`DELETE FROM "${type.table}" WHERE id = $1`, item.id);

  res.json({ message: "Item dihapus permanen" });
});

module.exports = router;