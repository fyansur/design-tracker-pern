function getPeriodRange(period) {
  const now = new Date();
  let start, end;
  if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildChartData(designs, period, start) {
  if (period === "month") {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => ({
      label: String(i + 1),
      completed: designs.filter((d) => d.completedAt.getDate() === i + 1).length,
    }));
  }
  if (period === "year") {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months.map((label, i) => ({
      label,
      completed: designs.filter((d) => d.completedAt.getMonth() === i).length,
    }));
  }
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return days.map((label, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { label, completed: designs.filter((d) => sameDay(d.completedAt, date)).length };
  });
}

module.exports = { getPeriodRange, sameDay, buildChartData };