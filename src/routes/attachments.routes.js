const { Router } = require("express");
const crypto = require("crypto");
const { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const prisma = require("../lib/prisma");
const r2 = require("../lib/r2");
const authRequired = require("../middleware/auth.middleware");

const router = Router({ mergeParams: true });
router.use(authRequired);

const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME = "image/png";

// STEP 1 — minta izin upload (presigned URL)
router.post("/presign", async (req, res) => {
  try {
    const designId = Number(req.params.designId);
    const { fileName, fileSize, mimeType } = req.body;

    if (mimeType !== ALLOWED_MIME) {
      return res.status(400).json({ message: "Only PNG files are allowed" });
    }
    if (!fileSize || fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File must be under 100MB" });
    }

    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design || design.userId !== req.userId) {
      return res.status(403).json({ message: "This design doesn't belong to you" });
    }

    const currentCount = await prisma.designAttachment.count({ where: { designId } });
    if (currentCount >= MAX_ATTACHMENTS) {
      return res.status(409).json({ message: `Maximum ${MAX_ATTACHMENTS} attachments per design` });
    }

    const fileKey = `designs/${designId}/${crypto.randomUUID()}.png`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 menit

    res.json({ uploadUrl, fileKey });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// STEP 2 — konfirmasi upload sukses, simpen metadata
router.post("/confirm", async (req, res) => {
  try {
    const designId = Number(req.params.designId);
    const { fileKey, fileName, fileSize, mimeType } = req.body;

    // Verifikasi filenya BENERAN ada di R2 (bukan cuma percaya klien)
    try {
      await r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: fileKey }));
    } catch {
      return res.status(400).json({ message: "Upload verification failed" });
    }

    const attachment = await prisma.designAttachment.create({
      data: { designId, fileName, fileKey, fileSize, mimeType },
    });

    res.status(201).json({
      ...attachment,
      url: `${process.env.R2_PUBLIC_URL}/${fileKey}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete("/:attachmentId", async (req, res) => {
  try {
    const attachment = await prisma.designAttachment.findUnique({
      where: { id: Number(req.params.attachmentId) },
    });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });

    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: attachment.fileKey }));
    await prisma.designAttachment.delete({ where: { id: attachment.id } });

    res.json({ message: "Attachment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;