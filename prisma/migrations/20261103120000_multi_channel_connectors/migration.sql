-- Drop unique one-connector-per-channel constraint
DROP INDEX IF EXISTS "ChannelConnector_organizationId_channel_key";

-- ChannelConnector: multi-instance + agent assignment
ALTER TABLE "ChannelConnector" ADD COLUMN IF NOT EXISTS "externalKey" TEXT;
ALTER TABLE "ChannelConnector" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

-- Conversation: link to specific connector instance
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "connectorId" TEXT;

-- Backfill externalKey from config JSON where possible
UPDATE "ChannelConnector"
SET "externalKey" = NULLIF(config->>'phoneNumberId', '')
WHERE channel = 'WHATSAPP' AND "externalKey" IS NULL;

UPDATE "ChannelConnector"
SET "externalKey" = NULLIF(LOWER(config->>'fromEmail'), '')
WHERE channel = 'EMAIL' AND "externalKey" IS NULL;

-- Indexes + FKs
CREATE INDEX IF NOT EXISTS "ChannelConnector_organizationId_channel_idx" ON "ChannelConnector"("organizationId", "channel");
CREATE INDEX IF NOT EXISTS "ChannelConnector_assigneeId_idx" ON "ChannelConnector"("assigneeId");
CREATE INDEX IF NOT EXISTS "ChannelConnector_organizationId_externalKey_idx" ON "ChannelConnector"("organizationId", "externalKey");
CREATE INDEX IF NOT EXISTS "Conversation_connectorId_idx" ON "Conversation"("connectorId");
CREATE INDEX IF NOT EXISTS "Conversation_organizationId_connectorId_externalRef_idx" ON "Conversation"("organizationId", "connectorId", "externalRef");

DO $$ BEGIN
  ALTER TABLE "ChannelConnector" ADD CONSTRAINT "ChannelConnector_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectorId_fkey"
    FOREIGN KEY ("connectorId") REFERENCES "ChannelConnector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
