const { Router } = require("express");
const prisma = require("../lib/prisma");
const authRequired = require("../middleware/auth.middleware");

const router = Router();

router.use(authRequired); // semua route di bawah ini wajib login

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "name wajib diisi" });

    const owner = await prisma.owner.create({ data: { name } });
    res.status(201).json(owner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "name wajib diisi" });

    const owner = await prisma.owner.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
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
        message: "Owner masih punya store aktif, reassign atau hapus dulu store-nya",
      });
    }

    await prisma.owner.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Owner dihapus" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;