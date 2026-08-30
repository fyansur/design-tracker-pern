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
        if (!name) return res.status(400).json({ message: "name wajib diisi" });

        const design = await prisma.design.create({
            data: {
                name,
                userId: req.userId,
                storeId: storeId ? Number(storeId) : null,
                ownerId: ownerId ? Number(ownerId) : null,
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
            return res.status(403).json({ message: "Bukan design milik lo" });
        }

        const { name, storeId, ownerId, categoryId, referenceUrl, isCompleted } = req.body;

        // === Aturan utama: owner wajib sebelum boleh completed ===
        const resolvedOwnerId = ownerId !== undefined ? Number(ownerId) : design.ownerId;
        if (isCompleted === true && !resolvedOwnerId) {
            return res.status(422).json({
                message: "Design harus punya owner sebelum bisa di-complete",
                errors: { ownerId: "Owner wajib diisi" },
            });
        }

        // === Auto set/null completedAt, un-complete gak clear ownerId ===
        let completedAt;
        if (isCompleted === true && !design.isCompleted) {
            completedAt = new Date();
        } else if (isCompleted === false && design.isCompleted) {
            completedAt = null;
        }

        const updated = await prisma.design.update({
            where: { id: Number(req.params.id) },
            data: {
                name,
                storeId: storeId !== undefined ? (storeId ? Number(storeId) : null) : undefined,
                ownerId: ownerId !== undefined ? (ownerId ? Number(ownerId) : null) : undefined,
                categoryId: categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : undefined,
                referenceUrl,
                isCompleted,
                completedAt,
            },
        });
        if (isCompleted === true && !design.isCompleted) {
            await recordActivity({ userId: req.userId, subjectType: "Design", subjectId: updated.id, event: "completed", itemName: updated.name });
        } else if (isCompleted === false && design.isCompleted) {
            await recordActivity({ userId: req.userId, subjectType: "Design", subjectId: updated.id, event: "pending", itemName: updated.name });
        } else {
            await recordActivity({ userId: req.userId, subjectType: "Design", subjectId: updated.id, event: "updated", itemName: updated.name });
        }
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/:id/pin", async (req, res) => {
    try {
        const design = await prisma.design.findUnique({ where: { id: Number(req.params.id) } });
        if (!design || design.userId !== req.userId) {
            return res.status(403).json({ message: "Bukan design milik lo" });
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
            return res.status(403).json({ message: "Bukan design milik lo" });
        }

        await prisma.design.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Design dihapus" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/:id/goals", async (req, res) => {
    try {
        const { goalId } = req.body;
        if (!goalId) return res.status(400).json({ message: "goalId wajib diisi" });

        const design = await prisma.design.findUnique({ where: { id: Number(req.params.id) } });
        if (!design || design.userId !== req.userId) {
            return res.status(403).json({ message: "Bukan design milik lo" });
        }

        const goal = await prisma.goal.findUnique({ where: { id: Number(goalId) } });
        if (!goal || goal.userId !== req.userId) {
            return res.status(403).json({ message: "Bukan goal milik lo" });
        }

        const link = await prisma.designGoal.create({
            data: { designId: design.id, goalId: goal.id },
        });
        res.status(201).json(link);
    } catch (err) {
        if (err.code === "P2002") {
            // unique constraint [designId, goalId] kena — udah pernah di-assign
            return res.status(409).json({ message: "Design ini udah ke-assign ke goal ini" });
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
        res.json({ message: "Design dilepas dari goal" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;