const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const recordActivity = require("../lib/activityLog");

const router = Router();
router.use(authRequired);

router.get("/", async (req, res) => {
    const designs = await prisma.design.findMany({
        where: { userId: req.userId },
        include: { owner: true, store: true, category: true, goals: { include: { goal: true } } },
        orderBy: { createdAt: "desc" },
    });
    res.json(designs);
});

router.post("/", async (req, res) => {
    try {
        const { name, storeId, ownerId, categoryId, referenceUrl } = req.body;
        if (!name) return res.status(400).json({ message: "Name is required" });

        let resolvedOwnerId = null;

        if (storeId) {
            // Store selected → owner MUST follow the store's owner, ownerId from body is ignored
            const store = await prisma.store.findUnique({ where: { id: Number(storeId) } });
            if (!store) return res.status(404).json({ message: "Store not found" });
            resolvedOwnerId = store.ownerId;
        } else if (ownerId) {
            // Store kosong → owner boleh manual
            resolvedOwnerId = Number(ownerId);
        }

        const design = await prisma.design.create({
            data: {
                name,
                userId: req.userId,
                storeId: storeId ? Number(storeId) : null,
                ownerId: resolvedOwnerId,
                categoryId: categoryId ? Number(categoryId) : null,
                referenceUrl: referenceUrl || null,
            },
        });

        await recordActivity({ userId: req.userId, subjectType: "Design", subjectId: design.id, event: "created", itemName: design.name });
        res.status(201).json(design);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const design = await prisma.design.findUnique({ where: { id: Number(req.params.id) } });
        if (!design || design.userId !== req.userId) {
            return res.status(403).json({ message: "Not your design" });
        }

        const { name, storeId, ownerId, categoryId, referenceUrl, isCompleted } = req.body;

        const nextStoreId = storeId !== undefined ? (storeId ? Number(storeId) : null) : design.storeId;

        let resolvedOwnerId;
        if (nextStoreId) {
            // Ada store (baru atau lama) → owner WAJIB ikut owner store, ownerId dari body diabaikan
            const store = await prisma.store.findUnique({ where: { id: nextStoreId } });
            resolvedOwnerId = store?.ownerId ?? null;
        } else {
            // Gak ada store → owner manual (dari body kalau dikirim, atau tetap yang lama)
            resolvedOwnerId = ownerId !== undefined ? (ownerId ? Number(ownerId) : null) : design.ownerId;
        }

        if (isCompleted === true && !resolvedOwnerId) {
            return res.status(422).json({
                message: "Design must have an owner before it can be completed",
                errors: { ownerId: "Owner is required (or select a store first)" },
            });
        }

        let completedAt;
        if (isCompleted === true && !design.isCompleted) completedAt = new Date();
        else if (isCompleted === false && design.isCompleted) completedAt = null;

        const updated = await prisma.design.update({
            where: { id: Number(req.params.id) },
            data: {
                name,
                storeId: nextStoreId,
                ownerId: resolvedOwnerId,
                categoryId: categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : undefined,
                referenceUrl,
                isCompleted,
                completedAt,
            },
        });
        await recordActivity({ userId: req.userId, subjectType: "Design", subjectId: design.id, event: "updated", itemName: design.name });
        
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/:id/pin", async (req, res) => {
    try {
        const design = await prisma.design.findUnique({ where: { id: Number(req.params.id) } });
        if (!design || design.userId !== req.userId) {
            return res.status(403).json({ message: "Not your design" });
        }

        const updated = await prisma.design.update({
            where: { id: Number(req.params.id) },
            data: {
                isPinned: !design.isPinned,
                pinnedAt: design.isPinned ? null : new Date(),
            },
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/:id", async (req, res) => {
  try {
    const design = await prisma.design.findUnique({ where: { id: Number(req.params.id) } });
    if (!design || design.userId !== req.userId) {
      return res.status(403).json({ message: "This design doesn't belong to you" });
    }

    await recordActivity({ userId: req.userId, subjectType: "Design", subjectId: design.id, event: "deleted", itemName: design.name });

    // BARU: soft-delete juga DesignGoal yang masih nunjuk ke design ini,
    // biar gak ada row "yatim" yang bikin dg.design jadi null pas design lagi di-trash
    await prisma.designGoal.updateMany({
      where: { designId: design.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await prisma.design.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Design deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/goals", async (req, res) => {
    try {
        const { goalId } = req.body;
        if (!goalId) return res.status(400).json({ message: "goalId is required" });

        const design = await prisma.design.findUnique({ where: { id: Number(req.params.id) } });
        if (!design || design.userId !== req.userId) {
            return res.status(403).json({ message: "Not your design" });
        }

        const goal = await prisma.goal.findUnique({ where: { id: Number(goalId) } });
        if (!goal || goal.userId !== req.userId) {
            return res.status(403).json({ message: "Not your goal" });
        }

        const link = await prisma.designGoal.create({
            data: { designId: design.id, goalId: goal.id },
        });
        res.status(201).json(link);
    } catch (err) {
        if (err.code === "P2002") {
            // unique constraint [designId, goalId] kena — udah pernah di-assign
            return res.status(409).json({ message: "Design is already assigned to this goal" });
        }
        res.status(500).json({ message: err.message });
    }
});

router.delete("/:id/goals/:goalId", async (req, res) => {
    try {
        await prisma.designGoal.delete({
            where: {
                designId_goalId: {
                    designId: Number(req.params.id),
                    goalId: Number(req.params.goalId),
                },
            },
        });
        res.json({ message: "Design removed from goal" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;