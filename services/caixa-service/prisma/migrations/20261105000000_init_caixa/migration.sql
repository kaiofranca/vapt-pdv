-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "cobrancas_comanda" (
    "id" SERIAL NOT NULL,
    "comanda_id" INTEGER NOT NULL,
    "mesa" INTEGER NOT NULL,
    "garcom_id" INTEGER NOT NULL,
    "nome_cliente" VARCHAR(120),
    "status" VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',
    "aplicar_taxa_servico" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxa_servico" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "valor_pago" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "saldo_restante" DECIMAL(10,2) NOT NULL,
    "troco_total" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "modo_divisao" VARCHAR(20) NOT NULL DEFAULT 'integral',
    "quantidade_pagadores" INTEGER NOT NULL DEFAULT 1,
    "itens_snapshot" JSONB NOT NULL,
    "divisao_detalhes" JSONB,
    "fechada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paga_em" TIMESTAMPTZ,

    CONSTRAINT "cobrancas_comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_parcela" (
    "id" SERIAL NOT NULL,
    "cobranca_id" INTEGER NOT NULL,
    "comanda_id" INTEGER NOT NULL,
    "numero_parcela" INTEGER NOT NULL,
    "pagador_label" VARCHAR(120),
    "forma_pagamento" VARCHAR(20) NOT NULL,
    "valor_aplicado" DECIMAL(10,2) NOT NULL,
    "valor_recebido" DECIMAL(10,2) NOT NULL,
    "troco" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "registrado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibos_venda" (
    "id" SERIAL NOT NULL,
    "codigo_autenticacao" VARCHAR(64) NOT NULL,
    "comanda_id" INTEGER NOT NULL,
    "cobranca_id" INTEGER NOT NULL,
    "resumo_recibo" JSONB NOT NULL,
    "emitido_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_processados" (
    "evento_id" UUID NOT NULL,
    "evento" VARCHAR(60) NOT NULL,
    "processado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_processados_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "outbox_eventos" (
    "id" UUID NOT NULL,
    "tipo_evento" VARCHAR(60) NOT NULL,
    "chave_agregado" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_em" TIMESTAMPTZ,

    CONSTRAINT "outbox_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_comanda_comanda_id_key" ON "cobrancas_comanda"("comanda_id");

-- CreateIndex
CREATE INDEX "cobrancas_comanda_status_idx" ON "cobrancas_comanda"("status", "fechada_em" DESC);

-- CreateIndex
CREATE INDEX "pagamentos_parcela_cobranca_idx" ON "pagamentos_parcela"("cobranca_id", "numero_parcela" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "recibos_venda_codigo_autenticacao_key" ON "recibos_venda"("codigo_autenticacao");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_venda_comanda_id_key" ON "recibos_venda"("comanda_id");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_venda_cobranca_id_key" ON "recibos_venda"("cobranca_id");

-- CreateIndex
CREATE INDEX "caixa_outbox_pendentes_idx" ON "outbox_eventos"("status", "criado_em" ASC);

-- AddForeignKey
ALTER TABLE "pagamentos_parcela" ADD CONSTRAINT "pagamentos_parcela_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas_comanda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_venda" ADD CONSTRAINT "recibos_venda_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas_comanda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
