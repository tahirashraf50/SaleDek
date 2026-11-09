-- AlterTable
ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconPath` VARCHAR(191) NULL;
ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconData` LONGTEXT NULL;
ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconMime` VARCHAR(191) NULL;
