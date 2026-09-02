const { sameDay } = require("./chartHelpers");

function targetOn(dg, date) {
  const applicable = [...dg.targets]
    .filter((t) => t.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom - a.effectiveFrom);
  return applicable[0]?.targetCount ?? null;
}

function dailyGoalDisplayName(dg) {
  return dg.scope === "STORE" ? dg.store?.name : dg.scope === "OWNER" ? dg.owner?.name : "Global";
}

async function computeDailyGoalStats({ prisma, userId, dailyGoals, start, end }) {
  const daysInPeriod = [];
  {
    const cursor = new Date(start);
    while (cursor <= end) {
      daysInPeriod.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const periodDesigns = await prisma.design.findMany({
    where: { userId, isCompleted: true, completedAt: { gte: start, lte: end } },
    select: { completedAt: true, storeId: true, ownerId: true },
  });

  function achievedCountOnSync(dg, date) {
    return periodDesigns.filter((d) => {
      if (!sameDay(d.completedAt, date)) return false;
      if (dg.scope === "STORE") return d.storeId === dg.storeId;
      if (dg.scope === "OWNER") return d.ownerId === dg.ownerId;
      return true;
    }).length;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dailyGoals.map((dg) => {
    let achievedDays = 0;
    for (const date of daysInPeriod) {
      const target = targetOn(dg, date);
      if (target === null) continue;
      if (achievedCountOnSync(dg, date) >= target) achievedDays++;
    }
    return {
      dailyGoalId: dg.id,
      scope: dg.scope,
      displayName: dailyGoalDisplayName(dg),
      targetCount: targetOn(dg, today),
      achievedToday: achievedCountOnSync(dg, today),
      achievedDays,
      totalDays: daysInPeriod.length,
      store: dg.store ?? null,
      owner: dg.owner ?? null,
    };
  });
}

module.exports = { targetOn, dailyGoalDisplayName, computeDailyGoalStats };