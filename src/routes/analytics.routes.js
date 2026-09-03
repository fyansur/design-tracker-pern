const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const { getPeriodRange, buildChartData } = require("../lib/chartHelpers");

const router = Router();
router.use(authRequired);

function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
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
      select: { completedAt: true, storeId: true, categoryId: true, ownerId: true },
    });

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
    const prevCompletedCount = await prisma.design.count({
      where: { userId: req.userId, isCompleted: true, completedAt: { gte: prevStart, lte: prevEnd } },
    });

    // --- Top Store (reuse pola ranking) ---
    const stores = await prisma.store.findMany({ where: { userId: req.userId } });
    const topStores = stores
      .map((s) => ({
        id: s.id, name: s.name, color: s.color,
        count: completedDesigns.filter((d) => d.storeId === s.id).length,
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- Top Category ---
    const categories = await prisma.category.findMany();
    const topCategories = categories
      .map((c) => ({
        id: c.id, name: c.name,
        count: completedDesigns.filter((d) => d.categoryId === c.id).length,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- Top Owner ---
    const owners = await prisma.owner.findMany();
    const topOwners = owners
      .map((o) => ({
        id: o.id, name: o.name,
        count: completedDesigns.filter((d) => d.ownerId === o.id).length,
      }))
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      period,
      totalIdeas,
      totalIdeasChangePct: pctChange(totalIdeas, prevTotalIdeas),
      completedCount: completedDesigns.length,
      completedCountChangePct: pctChange(completedDesigns.length, prevCompletedCount),
      chartData: buildChartData(completedDesigns, period, start),
      topStores,
      topCategories,
      topOwners,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;