-- CreateTable
CREATE TABLE "DesignAttachment" (
    "id" SERIAL NOT NULL,
    "designId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignAttachment_fileKey_key" ON "DesignAttachment"("fileKey");

-- AddForeignKey
ALTER TABLE "DesignAttachment" ADD CONSTRAINT "DesignAttachment_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
