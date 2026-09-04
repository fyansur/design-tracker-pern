const { Router } = require("express");
const prisma = require("../lib/prisma");
const { toLocalDateString } = require("../lib/chartHelpers");
const router = Router();

router.get("/:token", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { monitorToken: req.params.token } });
    if (!user) return res.status(404).json({ message: "Monitor not found" });

    const ownerId = req.query.owner_id;
    const ownerFilter = ownerId && ownerId !== "all" ? Number(ownerId) : null;

    // Filter dipakai konsisten di SEMUA angka di halaman ini
    const completedWhere = {
      userId: user.id,
      isCompleted: true,
      ...(ownerFilter ? { store: { ownerId: ownerFilter } } : {}),
    };
    const pendingWhere = {
      userId: user.id,
      isCompleted: false,
      ...(ownerFilter ? { ownerId: ownerFilter } : {}),
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const designsToday = await prisma.design.count({
      where: { ...completedWhere, completedAt: { gte: today } },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const designsLast30Days = await prisma.design.count({
      where: { ...completedWhere, completedAt: { gte: thirtyDaysAgo } },
    });

    const totalAllTime = await prisma.design.count({ where: completedWhere });
    const pendingCount = await prisma.design.count({ where: pendingWhere });
    const averagePerDay = Math.round((designsLast30Days / 30) * 10) / 10;

    const yearAgo = new Date();
    yearAgo.setDate(yearAgo.getDate() - 365);
    const rawDesigns = await prisma.design.findMany({
      where: { ...completedWhere, completedAt: { gte: yearAgo } },
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

    // Streak: mundur dari HARI INI, berhenti di hari pertama yang count-nya 0
    let streak = 0;
    for (let i = calendarData.length - 1; i >= 0; i--) {
      if (calendarData[i].count > 0) streak++;
      else break;
    }

    // Breakdown per Store, ikut filter owner yang sama
    const storeBreakdownMap = {};
    for (const d of rawDesigns) {
      const name = d.store?.name || "Unknown Store";
      storeBreakdownMap[name] = storeBreakdownMap[name] || { store_name: name, color: d.store?.color || "#9e9e9e", count: 0 };
      storeBreakdownMap[name].count++;
    }
    const storeBreakdown = Object.values(storeBreakdownMap).sort((a, b) => b.count - a.count);

    const page = Number(req.query.page) || 1;
    const perPage = 5;
    const recentCompletedDesigns = await prisma.design.findMany({
      where: completedWhere,
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
      totalAllTime,
      pendingCount,
      averagePerDay,
      streak,
      calendarData,
      storeBreakdown,
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
      perPage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;