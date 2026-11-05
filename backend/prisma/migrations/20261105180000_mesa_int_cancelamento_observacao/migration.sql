-- AlterTable
ALTER TABLE "comandas" ALTER COLUMN "mesa" TYPE INTEGER USING "mesa"::integer;
ALTER TABLE "comandas" ADD COLUMN "cancelada_em" TIMESTAMP(3);
ALTER TABLE "comandas" ADD COLUMN "motivo_cancelamento" VARCHAR(240);

-- AlterTable
ALTER TABLE "itens_comanda" ADD COLUMN "observacao" VARCHAR(240);
