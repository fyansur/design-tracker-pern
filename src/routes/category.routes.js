const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");

const router = Router();
router.use(authRequired);

router.get("/", async (req, res) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
});
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "name wajib diisi" });

    // firstOrCreate-equivalent: kalau nama udah ada, pakai yang lama
    const category = await prisma.category.findFirst({ where: { name } })
      ?? await prisma.category.create({ data: { name } });

    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Category dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;