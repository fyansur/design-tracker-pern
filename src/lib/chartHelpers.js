function getPeriodRange(period) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start;
  if (period === "month") {
    start = new Date(now);
    start.setDate(start.getDate() - 29); // 30 hari termasuk hari ini
    start.setHours(0, 0, 0, 0);
  } else if (period === "year") {
    start = new Date(now.getFullYear(), now.getMonth() - 11, 1); // 12 bulan ke belakang
    start.setHours(0, 0, 0, 0);
  } else {
    // week
    start = new Date(now);
    start.setDate(start.getDate() - 6); // 7 hari termasuk hari ini
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function buildChartData(designs, period, start) {
  if (period === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      return {
        label: monthDate.toLocaleDateString("en-US", { month: "short" }),
        completed: designs.filter((d) => sameMonth(d.completedAt, monthDate)).length,
      };
    });
  }
  if (period === "month") {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return {
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        completed: designs.filter((d) => sameDay(d.completedAt, date)).length,
      };
    });
  }
  // week — rolling 7 hari
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      completed: designs.filter((d) => sameDay(d.completedAt, date)).length,
    };
  });
}

module.exports = { getPeriodRange, sameDay, buildChartData };