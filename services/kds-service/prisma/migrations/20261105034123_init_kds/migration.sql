-- CreateTable
CREATE TABLE "fichas_preparo" (
    "id" SERIAL NOT NULL,
    "comanda_id" INTEGER NOT NULL,
    "item_comanda_id" INTEGER NOT NULL,
    "mesa" INTEGER NOT NULL,
    "garcom_id" INTEGER NOT NULL,
    "nome_garcom" VARCHAR(120),
    "setor" VARCHAR(30) NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "nome_produto" VARCHAR(140) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" VARCHAR(240),
    "status" VARCHAR(20) NOT NULL DEFAULT 'recebido',
    "recebido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciado_em" TIMESTAMPTZ(6),
    "pronto_em" TIMESTAMPTZ(6),
    "entregue_em" TIMESTAMPTZ(6),

    CONSTRAINT "fichas_preparo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_processados" (
    "evento_id" UUID NOT NULL,
    "evento" VARCHAR(60) NOT NULL,
    "processado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_processados_pkey" PRIMARY KEY ("evento_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fichas_preparo_item_comanda_id_key" ON "fichas_preparo"("item_comanda_id");

-- CreateIndex
CREATE INDEX "fichas_preparo_fila_idx" ON "fichas_preparo"("setor", "status", "recebido_em" ASC);

-- CreateIndex
CREATE INDEX "fichas_preparo_comanda_idx" ON "fichas_preparo"("comanda_id", "status");
