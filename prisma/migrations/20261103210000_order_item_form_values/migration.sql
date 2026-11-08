-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "formValues" JSONB;
