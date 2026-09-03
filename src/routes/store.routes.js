const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const recordActivity = require("../lib/activityLog");
const { computeDailyGoalStats } = require("../lib/dailyGoalHelpers");
const router = Router();
router.use(authRequired);
const { getPeriodRange, buildChartData } = require("../lib/chartHelpers");

router.get("/", async (req, res) => {
  const stores = await prisma.store.findMany({
    where: { userId: req.userId },
    include: {
      owner: true,
      _count: { select: { designs: true } },
    },
  });

  const storesWithCompleted = await Promise.all(
    stores.map(async (s) => {
      const completedCount = await prisma.design.count({
        where: { storeId: s.id, isCompleted: true },
      });
      return { ...s, designCount: s._count.designs, completedCount };
    })
  );

  res.json(storesWithCompleted);
});

router.get("/:id", async (req, res) => {
  try {
    const store = await prisma.store.findUnique({
      where: { id: Number(req.params.id) },
      include: { owner: true },
    });
    if (!store || store.userId !== req.userId) {
      return res.status(403).json({ message: "Not your store" });
    }

    const period = ["week", "month", "year"].includes(req.query.period) ? req.query.period : "week";
    const { start, end } = getPeriodRange(period);

    const completedDesigns = await prisma.design.findMany({
      where: { userId: req.userId, storeId: store.id, isCompleted: true, completedAt: { gte: start, lte: end } },
      select: { completedAt: true },
    });

    const dailyGoals = await prisma.dailyGoal.findMany({
      where: {
        userId: req.userId,
        OR: [
          { scope: "STORE", storeId: store.id },
          { scope: "OWNER", ownerId: store.ownerId },
          { scope: "GLOBAL" },
        ],
      },
      include: { store: true, owner: true, targets: true },
    });
    const dailyGoalStats = await computeDailyGoalStats({ prisma, userId: req.userId, dailyGoals, start, end });

    const goals = await prisma.goal.findMany({
      where: {
        userId: req.userId,
        isCompleted: false,
        OR: [
          { scope: "STORE", storeId: store.id },
          { scope: "OWNER", ownerId: store.ownerId },
          { scope: "GLOBAL" },
        ],
      },
      include: { store: true, designs: { include: { design: true } } },
    });
    const goalsWithProgress = goals.map((g) => ({
      ...g,
      completedCount: g.designs.filter((dg) => dg.design.isCompleted).length,
    }));

    const designs = await prisma.design.findMany({
      where: { userId: req.userId, storeId: store.id },
      include: { owner: true, category: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      store,
      period,
      chartData: buildChartData(completedDesigns, period, start),
      dailyGoalStats,
      goals: goalsWithProgress,
      designs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, color, ownerId } = req.body;
    if (!name || !color || !ownerId) {
      return res.status(400).json({ message: "name, color, ownerId are required" });
    }

    const store = await prisma.store.create({
      data: {
        name,
        color,
        ownerId: Number(ownerId),
        userId: req.userId,
        url: `https://etsy.com/shop/${name}`,
      },
    });
    await recordActivity({ userId: req.userId, subjectType: "Store", subjectId: store.id, event: "created", itemName: store.name });
    res.status(201).json(store);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: Number(req.params.id) } });
    if (!store || store.userId !== req.userId) {
      return res.status(403).json({ message: "Not your store" });
    }

    const { name, color, ownerId } = req.body;
    const updated = await prisma.store.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        color,
        ownerId: ownerId ? Number(ownerId) : undefined,
        url: name ? `https://etsy.com/shop/${name}` : undefined,
      },
    });
    await recordActivity({ userId: req.userId, subjectType: "Store", subjectId: updated.id, event: "updated", itemName: updated.name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: Number(req.params.id) } });
    if (!store || store.userId !== req.userId) {
      return res.status(403).json({ message: "Not your store" });
    }

    await recordActivity({ userId: req.userId, subjectType: "Store", subjectId: store.id, event: "deleted", itemName: store.name });
    await prisma.store.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Store deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;