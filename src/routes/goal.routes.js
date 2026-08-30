const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");

const router = Router();
router.use(authRequired);

function calculateDeadline(durationType, durationAmount) {
  const now = new Date();
  switch (durationType) {
    case "daily": return new Date(now.setDate(now.getDate() + 1));
    case "weekly": return new Date(now.setDate(now.getDate() + 7));
    case "monthly": return new Date(now.setMonth(now.getMonth() + 1));
    case "yearly": return new Date(now.setFullYear(now.getFullYear() + 1));
    case "custom": return new Date(now.setDate(now.getDate() + Number(durationAmount || 0)));
    default: return null;
  }
}

router.get("/", async (req, res) => {
  const goals = await prisma.goal.findMany({
    where: { userId: req.userId },
    include: { store: true, owner: true, designs: { include: { design: true } } },
  });

  // progress dihitung dari design yang di-assign DAN completed
  const withProgress = goals.map((g) => ({
    ...g,
    completedCount: g.designs.filter((dg) => dg.design.isCompleted).length,
  }));

  res.json(withProgress);
});

router.post("/", async (req, res) => {
  try {
    const { name, scope, storeId, ownerId, targetCount, durationType, durationAmount } = req.body;

    if (!targetCount) return res.status(400).json({ message: "targetCount wajib diisi" });

    let resolvedScope = "GLOBAL";
    let resolvedStoreId = null;
    let resolvedOwnerId = null;
    let resolvedName = name;

    if (scope === "STORE" && storeId) {
      const store = await prisma.store.findUnique({ where: { id: Number(storeId) } });
      if (!store || store.userId !== req.userId) return res.status(403).json({ message: "Bukan store milik lo" });
      resolvedScope = "STORE";
      resolvedStoreId = store.id;
      resolvedName = name || store.name;
    } else if (scope === "OWNER" && ownerId) {
      const owner = await prisma.owner.findUnique({ where: { id: Number(ownerId) } });
      if (!owner) return res.status(404).json({ message: "Owner tidak ditemukan" });
      resolvedScope = "OWNER";
      resolvedOwnerId = owner.id;
      resolvedName = name || owner.name;
    } else if (!name) {
      return res.status(400).json({ message: "name wajib diisi untuk goal global" });
    }

    const goal = await prisma.goal.create({
      data: {
        name: resolvedName,
        userId: req.userId,
        scope: resolvedScope,
        storeId: resolvedStoreId,
        ownerId: resolvedOwnerId,
        targetCount: Number(targetCount),
        deadline: calculateDeadline(durationType, durationAmount),
      },
    });
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/pin", async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: Number(req.params.id) } });
    if (!goal || goal.userId !== req.userId) return res.status(403).json({ message: "Bukan goal milik lo" });

    const updated = await prisma.goal.update({
      where: { id: Number(req.params.id) },
      data: { isPinned: !goal.isPinned, pinnedAt: goal.isPinned ? null : new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: Number(req.params.id) } });
    if (!goal || goal.userId !== req.userId) return res.status(403).json({ message: "Bukan goal milik lo" });

    await prisma.goal.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Goal dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;