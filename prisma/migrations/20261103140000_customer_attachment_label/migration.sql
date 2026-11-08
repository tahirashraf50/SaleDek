ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "label" TEXT;
CREATE INDEX IF NOT EXISTS "Attachment_customerId_idx" ON "Attachment"("customerId");
