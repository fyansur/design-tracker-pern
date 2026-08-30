const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const recordActivity = require("../lib/activityLog");

const router = Router();
router.use(authRequired);

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

router.get("/", async (req, res) => {
    const dailyGoals = await prisma.dailyGoal.findMany({
        where: { userId: req.userId },
        include: { store: true, owner: true, targets: true },
    });
    res.json(dailyGoals);
});

router.post("/", async (req, res) => {
    try {
        const { scope, storeId, ownerId, targetCount } = req.body;
        if (!scope || !targetCount) {
            return res.status(400).json({ message: "scope dan targetCount wajib diisi" });
        }

        const resolvedStoreId = scope === "STORE" ? Number(storeId) : null;
        const resolvedOwnerId = scope === "OWNER" ? Number(ownerId) : null;

        const exists = await prisma.dailyGoal.findFirst({
            where: { userId: req.userId, scope, storeId: resolvedStoreId, ownerId: resolvedOwnerId },
        });
        if (exists) {
            return res.status(409).json({ message: "Daily goal untuk target ini udah ada" });
        }

        const dailyGoal = await prisma.dailyGoal.create({
            data: { userId: req.userId, scope, storeId: resolvedStoreId, ownerId: resolvedOwnerId },
        });

        await prisma.dailyGoalTarget.create({
            data: {
                dailyGoalId: dailyGoal.id,
                targetCount: Number(targetCount),
                effectiveFrom: startOfToday(),
            },
        });
        await recordActivity({
            userId: req.userId,
            subjectType: "DailyGoal",
            subjectId: dailyGoal.id,
            event: "created",
            itemName: `Daily Goal (${scope})`,
        });
        res.status(201).json(dailyGoal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/:id/target", async (req, res) => {
    try {
        const dailyGoal = await prisma.dailyGoal.findUnique({ where: { id: Number(req.params.id) } });
        if (!dailyGoal || dailyGoal.userId !== req.userId) {
            return res.status(403).json({ message: "Bukan daily goal milik lo" });
        }

        const { targetCount } = req.body;
        if (!targetCount) return res.status(400).json({ message: "targetCount wajib diisi" });

        // upsert row HARI INI — kalau udah ada, update; kalau belum, buat baru.
        // Hari-hari sebelumnya gak pernah disentuh, histori tetap akurat.
        const target = await prisma.dailyGoalTarget.upsert({
            where: {
                dailyGoalId_effectiveFrom: {
                    dailyGoalId: dailyGoal.id,
                    effectiveFrom: startOfToday(),
                },
            },
            update: { targetCount: Number(targetCount) },
            create: {
                dailyGoalId: dailyGoal.id,
                targetCount: Number(targetCount),
                effectiveFrom: startOfToday(),
            },
        });
        await recordActivity({
            userId: req.userId,
            subjectType: "DailyGoal",
            subjectId: dailyGoal.id,
            event: "updated",
            itemName: `Daily Goal target`,
        });
        res.json(target);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const dailyGoal = await prisma.dailyGoal.findUnique({ where: { id: Number(req.params.id) } });
        if (!dailyGoal || dailyGoal.userId !== req.userId) {
            return res.status(403).json({ message: "Bukan daily goal milik lo" });
        }
        await recordActivity({
            userId: req.userId,
            subjectType: "DailyGoal",
            subjectId: dailyGoal.id,
            event: "deleted",
            itemName: `Daily Goal (${dailyGoal.scope})`,
        });
        await prisma.dailyGoal.delete({ where: { id: Number(req.params.id) } });
        res.json({ message: "Daily goal dihapus" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;