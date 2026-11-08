-- AlterEnum
ALTER TYPE "SaaSPlanKey" ADD VALUE 'DEMO';

-- AlterTable
ALTER TABLE "SaaSPlan" ADD COLUMN "trialDays" INTEGER;
