-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;
ALTER TABLE `User` ADD COLUMN `activationToken` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `activationExpiresAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_activationToken_key` ON `User`(`activationToken`);
