const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");
const recordActivity = require("../lib/activityLog");
const router = Router();

router.use(authRequired); // semua route di bawah ini wajib login

router.get("/", async (req, res) => {
  const owners = await prisma.owner.findMany();
  res.json(owners);
});

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const owner = await prisma.owner.create({ data: { name } });
    await recordActivity({ userId: req.userId, subjectType: "Owner", subjectId: owner.id, event: "created", itemName: owner.name });
    res.status(201).json(owner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const owner = await prisma.owner.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
    await recordActivity({ userId: req.userId, subjectType: "Owner", subjectId: owner.id, event: "updated", itemName: owner.name });
    res.json(owner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const activeStoreCount = await prisma.store.count({
      where: { ownerId: Number(req.params.id) }, // soft-delete extension otomatis exclude yang udah deletedAt
    });

    if (activeStoreCount > 0) {
      return res.status(409).json({
        message: "Owner still has active stores, reassign or delete the stores first.",
      });
    }

    await recordActivity({ userId: req.userId, subjectType: "Owner", subjectId: Number(req.params.id), event: "deleted", itemName: "Owner" });
    await prisma.owner.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Owner deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;