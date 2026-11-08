-- AlterTable
ALTER TABLE "PlatformWebsiteSettings"
ADD COLUMN "heroBadge" TEXT NOT NULL DEFAULT 'CRM & SaaS',
ADD COLUMN "heroStats" JSONB NOT NULL DEFAULT '[{"value":"15d","label":"Free demo"},{"value":"6+","label":"Core modules"},{"value":"24/7","label":"Inbox ready"}]',
ADD COLUMN "newsTickerItems" JSONB NOT NULL DEFAULT '["WhatsApp Inbox","Sales Pipelines","Ticket SLA","JazzCash Payments","Customer Portal","Tenant Shop","Analytics","Automations"]',
ADD COLUMN "featuresTitle" TEXT NOT NULL DEFAULT 'Everything your team needs to grow',
ADD COLUMN "featuresSubtitle" TEXT NOT NULL DEFAULT 'Contact, sales, email, tasks, analytics, and support — one CRM workspace.',
ADD COLUMN "analysisTitle" TEXT NOT NULL DEFAULT 'Speed up your analysis',
ADD COLUMN "analysisBody" TEXT NOT NULL DEFAULT 'Expand research across your organization with customization, security, and compliance features built with enterprise in mind.',
ADD COLUMN "analysisBullets" JSONB NOT NULL DEFAULT '["Automated renewal tracking and reminders","Powerful filters and search to access information quickly","Folder structure to stay organized"]',
ADD COLUMN "integrations" JSONB NOT NULL DEFAULT '["WhatsApp","Email","JazzCash","Portal","Shop","Slack"]',
ADD COLUMN "integrationsTitle" TEXT NOT NULL DEFAULT 'Connect with your favourite Apps',
ADD COLUMN "integrationsBody" TEXT NOT NULL DEFAULT 'Keep your team members and customers in the loop by sharing your dashboard publicly or privately and receiving regular reports via email.',
ADD COLUMN "contactEmail" TEXT NOT NULL DEFAULT 'info@yourmail.com',
ADD COLUMN "contactPhone" TEXT NOT NULL DEFAULT '(00) 99 222 99566';
