const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");

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

module.exports = router;