const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const recordActivity = require("../lib/activityLog");

const router = Router();
router.use(authRequired);

const TYPES = {
  owner: { model: "owner", table: "Owner", scoped: false, subjectType: "Owner" },
  store: { model: "store", table: "Store", scoped: true, subjectType: "Store" },
  category: { model: "category", table: "Category", scoped: false, subjectType: null },
  design: { model: "design", table: "Design", scoped: true, subjectType: "Design" },
  goal: { model: "goal", table: "Goal", scoped: true, subjectType: null },
  "daily-goal": { model: "dailyGoal", table: "DailyGoal", scoped: true, subjectType: null },
};

router.get("/", async (req, res) => {
  const type = TYPES[req.query.type];
  if (!type) return res.status(400).json({ message: "Type is not valid" });

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
  if (!type) return res.status(400).json({ message: "Type is not valid" });

  const item = await prisma[type.model].findFirst({
    where: {
      id: Number(req.params.id),
      deletedAt: { not: null },
      ...(type.scoped ? { userId: req.userId } : {}),
    },
  });
  if (!item) return res.status(404).json({ message: "Item not found in trash" });

  const restored = await prisma[type.model].update({
    where: { id: item.id },
    data: { deletedAt: null },
  });

  if (type.subjectType) {
    await recordActivity({
      userId: req.userId,
      subjectType: type.subjectType,
      subjectId: restored.id,
      event: "recovered",
      itemName: restored.name,
    });
  }

  res.json(restored);
});

router.delete("/:type/:id", async (req, res) => {
  const type = TYPES[req.params.type];
  if (!type) return res.status(400).json({ message: "Type is not valid" });

  const item = await prisma[type.model].findFirst({
    where: {
      id: Number(req.params.id),
      deletedAt: { not: null },
      ...(type.scoped ? { userId: req.userId } : {}),
    },
  });
  if (!item) return res.status(404).json({ message: "Item not found in trash" });

  try {
    // Bersihin dulu child rows yang masih nunjuk balik ke row ini (gak ada onDelete: Cascade di schema)
    if (req.params.type === "daily-goal") {
      await prisma.dailyGoalTarget.deleteMany({ where: { dailyGoalId: item.id } });
    } else if (req.params.type === "goal") {
      await prisma.designGoal.deleteMany({ where: { goalId: item.id } });
    } else if (req.params.type === "design") {
      await prisma.designGoal.deleteMany({ where: { designId: item.id } });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "${type.table}" WHERE id = $1`, item.id);
    res.json({ message: "Item permanently deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;