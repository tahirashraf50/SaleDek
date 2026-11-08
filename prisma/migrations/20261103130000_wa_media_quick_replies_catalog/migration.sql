-- Quick replies for inbox / WhatsApp
CREATE TABLE IF NOT EXISTS "QuickReply" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shortcut" TEXT,
    "channel" "OmniChannel",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuickReply_organizationId_active_idx" ON "QuickReply"("organizationId", "active");

DO $$ BEGIN
  ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Product catalog sync fields for WhatsApp
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "whatsappProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "catalogSyncedAt" TIMESTAMP(3);
