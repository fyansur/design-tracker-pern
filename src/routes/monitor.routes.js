const { Router } = require("express");
const prisma = require("../lib/prisma");
const { toLocalDateString } = require("../lib/chartHelpers");
const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { monitorToken: req.params.token } });
    if (!user) return res.status(404).json({ message: "Monitor tidak ditemukan" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const designsToday = await prisma.design.count({
      where: { userId: user.id, isCompleted: true, completedAt: { gte: today } },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const designsLast30Days = await prisma.design.count({
      where: { userId: user.id, isCompleted: true, completedAt: { gte: thirtyDaysAgo } },
    });

    const yearAgo = new Date();
    yearAgo.setDate(yearAgo.getDate() - 365);
    const rawDesigns = await prisma.design.findMany({
      where: { userId: user.id, isCompleted: true, completedAt: { gte: yearAgo } },
      include: { store: true },
    });

    const byDate = {};
    for (const d of rawDesigns) {
      const key = toLocalDateString(d.completedAt);
      byDate[key] = byDate[key] || [];
      byDate[key].push(d);
    }

    const calendarData = [];
    for (let i = 365; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = toLocalDateString(date);
      const dayDesigns = byDate[key] || [];
      const count = dayDesigns.length;
      let level = 0;
      if (count > 0) level = 1;
      if (count >= 3) level = 2;
      if (count >= 5) level = 3;
      if (count >= 8) level = 4;

      const storeMap = {};
      for (const d of dayDesigns) {
        const name = d.store?.name || "Unknown Store";
        storeMap[name] = storeMap[name] || { store_name: name, color: d.store?.color || "#9e9e9e", count: 0 };
        storeMap[name].count++;
      }

      calendarData.push({ date: key, count, level, stores: Object.values(storeMap) });
    }

    const ownerId = req.query.owner_id;
    const where = {
      userId: user.id,
      isCompleted: true,
      ...(ownerId && ownerId !== "all" ? { store: { ownerId: Number(ownerId) } } : {}),
    };

    const page = Number(req.query.page) || 1;
    const perPage = 10;
    const recentCompletedDesigns = await prisma.design.findMany({
      where,
      include: { store: { include: { owner: true } } },
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const storesWithDesigns = await prisma.store.findMany({
      where: { designs: { some: { userId: user.id } } },
      include: { owner: true },
    });
    const owners = [...new Map(storesWithDesigns.map((s) => [s.owner.id, s.owner])).values()];

    res.json({
      monitoredUser: { name: user.name, isActive: user.isOnline },
      designsToday,
      designsLast30Days,
      calendarData,
      recentCompletedDesigns: recentCompletedDesigns.map((d) => ({
        id: d.id,
        name: d.name,
        store_name: d.store?.name || "Unknown Store",
        owner_id: d.store?.owner?.id ?? null,
        owner_name: d.store?.owner?.name || "Unknown Owner",
        completed_at: d.completedAt,
      })),
      owners,
      currentOwnerId: ownerId || "all",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;