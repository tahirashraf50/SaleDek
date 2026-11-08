-- CreateTable
CREATE TABLE "PlatformWebsiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "brandName" TEXT NOT NULL DEFAULT 'PulseCRM',
    "logoPath" TEXT,
    "heroHeadline" TEXT NOT NULL DEFAULT 'Omnichannel complaints and sales in one workspace.',
    "heroSubtext" TEXT NOT NULL DEFAULT 'WhatsApp-style inbox, tickets, payments, shop, and portal — multi-tenant SaaS for every company you onboard.',
    "heroCtaLabel" TEXT NOT NULL DEFAULT 'Start free trial',
    "heroCtaHref" TEXT NOT NULL DEFAULT '/register?plan=DEMO',
    "heroSecondaryLabel" TEXT NOT NULL DEFAULT 'View packages',
    "heroSecondaryHref" TEXT NOT NULL DEFAULT '/site/pricing',
    "sectionTitle" TEXT NOT NULL DEFAULT 'From first message to paid order',
    "sectionBody" TEXT NOT NULL DEFAULT 'Agents work one thread — convert to a complaint, a sale, or both without leaving the inbox.',
    "midTitle" TEXT NOT NULL DEFAULT 'Built for the teams who answer the phone',
    "midBody" TEXT NOT NULL DEFAULT 'Field service, telecom, retail — wherever complaints and sales collide. PulseCRM keeps the conversation, the ticket, and the payment in sync.',
    "ctaTitle" TEXT NOT NULL DEFAULT 'Stand up your tenant in minutes',
    "ctaBody" TEXT NOT NULL DEFAULT 'Pick a plan, create your org, and invite agents. Super admins manage every tenant from one console.',
    "footerBlurb" TEXT NOT NULL DEFAULT 'Multi-tenant complaint and sales workspace — inbox, tickets, payments, shop, and portal in one platform.',
    "footerNote" TEXT NOT NULL DEFAULT 'Built for service + sales teams',
    "copyrightName" TEXT NOT NULL DEFAULT 'PulseCRM',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformWebsiteSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformWebsiteSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
