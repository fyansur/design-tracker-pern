const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");

const router = Router();
router.use(authRequired);

router.get("/", async (req, res) => {
  const stores = await prisma.store.findMany({
    where: { userId: req.userId },
    include: { owner: true },
  });
  res.json(stores);
});

router.post("/", async (req, res) => {
  try {
    const { name, color, ownerId } = req.body;
    if (!name || !color || !ownerId) {
      return res.status(400).json({ message: "name, color, ownerId wajib diisi" });
    }

    const store = await prisma.store.create({
      data: {
        name,
        color,
        ownerId: Number(ownerId),
        userId: req.userId,
        url: `https://etsy.com/shop/${name}`,
      },
    });
    res.status(201).json(store);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: Number(req.params.id) } });
    if (!store || store.userId !== req.userId) {
      return res.status(403).json({ message: "Bukan store milik lo" });
    }

    const { name, color, ownerId } = req.body;
    const updated = await prisma.store.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        color,
        ownerId: ownerId ? Number(ownerId) : undefined,
        url: name ? `https://etsy.com/shop/${name}` : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { id: Number(req.params.id) } });
    if (!store || store.userId !== req.userId) {
      return res.status(403).json({ message: "Bukan store milik lo" });
    }

    await prisma.store.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Store dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;