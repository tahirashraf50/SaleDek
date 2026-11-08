-- CreateTable
CREATE TABLE "ChannelConnector" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "OmniChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'UI_ONLY',
    "webhookSecret" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelConnector_organizationId_idx" ON "ChannelConnector"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnector_organizationId_channel_key" ON "ChannelConnector"("organizationId", "channel");

-- AddForeignKey
ALTER TABLE "ChannelConnector" ADD CONSTRAINT "ChannelConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
