const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const { getPeriodRange, sameDay, buildChartData, toLocalDateString } = require("../lib/chartHelpers");
const router = Router();
router.use(authRequired);

function buildLast14Days(designs) {
  const result = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    result.push({
      date: toLocalDateString(date),
      count: designs.filter((d) => sameDay(d.completedAt, date)).length,
    });
  }
  return result;
}
function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null; // null = gak ada pembanding (baru mulai dari 0)
  return Math.round(((current - previous) / previous) * 1000) / 10; // 1 angka desimal
}
router.get("/", async (req, res) => {
  try {
    const period = ["week", "month", "year"].includes(req.query.period) ? req.query.period : "week";

    // --- Today stats ---
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const todayDesigns = await prisma.design.count({
      where: { userId: req.userId, createdAt: { gte: todayStart, lte: todayEnd } },
    });
    const todayCompletedDesigns = await prisma.design.count({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: todayStart, lte: todayEnd } },
    });
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const yesterdayDesigns = await prisma.design.count({
      where: { userId: req.userId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
    });
    const yesterdayCompletedDesigns = await prisma.design.count({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
    });
    // --- Totals ---
    const totalStores = await prisma.store.count({ where: { userId: req.userId } });
    const totalOwners = await prisma.owner.count();

    // --- Period-based stats (chart, ranking) ---
    const { start, end } = getPeriodRange(period);

    const periodLengthDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (periodLengthDays - 1));
    prevStart.setHours(0, 0, 0, 0);

    const prevTotalIdeas = await prisma.design.count({
      where: { userId: req.userId, createdAt: { gte: prevStart, lte: prevEnd } },
    });
    const prevCompletedDesigns = await prisma.design.count({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: prevStart, lte: prevEnd } },
    });

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

    // --- 14-day activity feed ---
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);
    const last14 = await prisma.design.findMany({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: fourteenDaysAgo } },
      select: { completedAt: true },
    });

    // --- Goals ---
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId, isCompleted: false },
      include: { store: true, designs: { include: { design: true } } },
    });
    const goalsWithProgress = goals.map((g) => ({
      ...g,
      completedCount: g.designs.filter((dg) => dg.design.isCompleted).length,
    }));

    // --- Daily Goals ---
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

    // --- Recent Activities ---
    const recentActivities = await prisma.activityLog.findMany({
      where: { userId: req.userId, subjectType: { in: ["Design", "Store", "Owner"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // --- Activity Block: 15 hari, hari ini di tengah (-7 s/d +7) ---
    const blockDates = Array.from({ length: 15 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + (i - 7));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const rangeStart = blockDates[0];
    const rangeEnd = new Date(blockDates[blockDates.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);

    const blockDesigns = await prisma.design.findMany({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: rangeStart, lte: rangeEnd } },
      select: { completedAt: true },
    });

    function targetOn(dg, date) {
      const applicable = [...dg.targets]
        .filter((t) => t.effectiveFrom <= date)
        .sort((a, b) => b.effectiveFrom - a.effectiveFrom);
      return applicable[0]?.targetCount ?? null;
    }

    async function achievedCountOn(dg, date) {
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      return prisma.design.count({
        where: {
          userId: req.userId, isCompleted: true,
          completedAt: { gte: dayStart, lte: dayEnd },
          ...(dg.scope === "STORE" ? { storeId: dg.storeId } : dg.scope === "OWNER" ? { ownerId: dg.ownerId } : {}),
        },
      });
    }

    const activityBlocks = [];
    for (const date of blockDates) {
      const count = blockDesigns.filter((d) => sameDay(d.completedAt, date)).length;

      const dailyGoalStatuses = [];
      for (const dg of dailyGoals) {
        const target = targetOn(dg, date);
        const achievedCount = await achievedCountOn(dg, date);

        let status;
        if (target !== null) {
          status = achievedCount >= target ? "achieved" : "missed";
        } else {
          status = "no-target"; // selalu abu-abu, gak peduli achievedCount berapa
        }

        dailyGoalStatuses.push({
          dailyGoalId: dg.id,
          scope: dg.scope,
          displayName: dg.scope === "STORE" ? dg.store?.name : dg.scope === "OWNER" ? dg.owner?.name : "Global",
          status,
        });
      }

      activityBlocks.push({
        date: toLocalDateString(date),
        count,
        isToday: sameDay(date, new Date()),
        dailyGoalStatuses, // <-- array, bukan satu boolean
      });
    }

    const daysInPeriod = [];
    {
      const cursor = new Date(start);
      while (cursor <= end) {
        daysInPeriod.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const periodDesignsForGoals = await prisma.design.findMany({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: start, lte: end } },
      select: { completedAt: true, storeId: true, ownerId: true },
    });

    function achievedCountOnSync(dg, date) {
      return periodDesignsForGoals.filter((d) => {
        if (!sameDay(d.completedAt, date)) return false;
        if (dg.scope === "STORE") return d.storeId === dg.storeId;
        if (dg.scope === "OWNER") return d.ownerId === dg.ownerId;
        return true; // GLOBAL
      }).length;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyGoalStats = dailyGoals.map((dg) => {
      let achievedDays = 0;
      for (const date of daysInPeriod) {
        const target = targetOn(dg, date);
        if (target === null) continue;
        if (achievedCountOnSync(dg, date) >= target) achievedDays++;
      }

      return {
        dailyGoalId: dg.id,
        scope: dg.scope,
        displayName: dg.scope === "STORE" ? dg.store?.name : dg.scope === "OWNER" ? dg.owner?.name : "Global",
        targetCount: targetOn(dg, today),
        achievedToday: achievedCountOnSync(dg, today),
        achievedDays,
        totalDays: daysInPeriod.length,
      };
    });

    res.json({
      today: {
        designs: todayDesigns,
        completedDesigns: todayCompletedDesigns,
        designsChangePct: pctChange(todayDesigns, yesterdayDesigns),
        completedChangePct: pctChange(todayCompletedDesigns, yesterdayCompletedDesigns),
      },
      totals: { stores: totalStores, owners: totalOwners },
      period,
      totalIdeas,
      totalIdeasChangePct: pctChange(totalIdeas, prevTotalIdeas),
      completedCount: completedDesigns.length,
      completedCountChangePct: pctChange(completedDesigns.length, prevCompletedDesigns),
      chartData: buildChartData(completedDesigns, period, start),
      ranking,
      activityData: buildLast14Days(last14),
      goals: goalsWithProgress,
      dailyGoals: dailyGoalsToday,
      recentActivities,
      activityBlocks,
      dailyGoalStats,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }


});

module.exports = router;