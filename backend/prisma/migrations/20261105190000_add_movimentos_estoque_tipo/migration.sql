-- AlterTable
ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "tipo" TEXT DEFAULT 'saida';
