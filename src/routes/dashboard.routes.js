const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const { getPeriodRange, sameDay, buildChartData } = require("../lib/chartHelpers");
const router = Router();
router.use(authRequired);



function buildLast14Days(designs) {
  const result = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    result.push({
      date: date.toISOString().slice(0, 10),
      count: designs.filter((d) => sameDay(d.completedAt, date)).length,
    });
  }
  return result;
}

router.get("/", async (req, res) => {
  try {
    const period = ["week", "month", "year"].includes(req.query.period) ? req.query.period : "week";
    const { start, end } = getPeriodRange(period);

    const totalIdeas = await prisma.design.count({
      where: { userId: req.userId, createdAt: { gte: start, lte: end } },
    });

    const completedDesigns = await prisma.design.findMany({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: start, lte: end } },
      select: { completedAt: true, storeId: true },
    });

    const stores = await prisma.store.findMany({ where: { userId: req.userId } });
    const ranking = stores
      .map((store) => ({
        storeId: store.id,
        name: store.name,
        color: store.color,
        completedCount: completedDesigns.filter((d) => d.storeId === store.id).length,
      }))
      .sort((a, b) => b.completedCount - a.completedCount);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);
    const last14 = await prisma.design.findMany({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: fourteenDaysAgo } },
      select: { completedAt: true },
    });

    const goals = await prisma.goal.findMany({
      where: { userId: req.userId, isCompleted: false },
      include: { designs: { include: { design: true } } },
    });
    const goalsWithProgress = goals.map((g) => ({
      ...g,
      completedCount: g.designs.filter((dg) => dg.design.isCompleted).length,
    }));

    const dailyGoals = await prisma.dailyGoal.findMany({
      where: { userId: req.userId },
      include: { store: true, owner: true, targets: true },
    });
    const dailyGoalsToday = dailyGoals.map((dg) => {
      const target = dg.targets
        .filter((t) => t.effectiveFrom <= new Date())
        .sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0];
      return {
        id: dg.id,
        scope: dg.scope,
        displayName: dg.scope === "STORE" ? dg.store?.name : dg.scope === "OWNER" ? dg.owner?.name : "Global",
        targetCount: target?.targetCount ?? null,
      };
    });

    const recentActivities = await prisma.activityLog.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      period,
      totalIdeas,
      completedCount: completedDesigns.length,
      chartData: buildChartData(completedDesigns, period, start),
      ranking,
      activityData: buildLast14Days(last14),
      goals: goalsWithProgress,
      dailyGoals: dailyGoalsToday,
      recentActivities,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;