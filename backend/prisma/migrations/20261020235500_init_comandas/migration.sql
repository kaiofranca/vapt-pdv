CREATE TYPE "StatusComanda" AS ENUM ('aberta', 'fechada', 'paga', 'cancelada');

CREATE TYPE "FormaPagamento" AS ENUM ('dinheiro', 'pix', 'cartao');

CREATE TABLE "comandas" (
    "id" SERIAL NOT NULL,
    "mesa" TEXT NOT NULL,
    "nome_cliente" TEXT,
    "garcom_id" INTEGER NOT NULL,
    "status" "StatusComanda" NOT NULL DEFAULT 'aberta',
    "subtotal" DECIMAL(10,2),
    "taxa_servico" DECIMAL(10,2),
    "total" DECIMAL(10,2),
    "forma_pagamento" "FormaPagamento",
    "aberta_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechada_em" TIMESTAMP(3),
    "paga_em" TIMESTAMP(3),

    CONSTRAINT "comandas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itens_comanda" (
    "id" SERIAL NOT NULL,
    "comanda_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "nome_copiado" TEXT NOT NULL,
    "preco_copiado" DECIMAL(10,2) NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "itens_comanda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comandas_status_idx" ON "comandas"("status");

CREATE INDEX "comandas_mesa_idx" ON "comandas"("mesa");

CREATE INDEX "comandas_aberta_em_idx" ON "comandas"("aberta_em");

CREATE UNIQUE INDEX "comandas_mesa_aberta_unique_idx" ON "comandas"("mesa") WHERE "status" = 'aberta';

CREATE INDEX "itens_comanda_comanda_id_idx" ON "itens_comanda"("comanda_id");

CREATE INDEX "itens_comanda_produto_id_idx" ON "itens_comanda"("produto_id");

ALTER TABLE "itens_comanda" ADD CONSTRAINT "itens_comanda_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
