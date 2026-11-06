-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "eventos_processados" (
    "evento_id" UUID NOT NULL,
    "evento" VARCHAR(60) NOT NULL,
    "processado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_processados_pkey" PRIMARY KEY ("evento_id")
);

-- CreateTable
CREATE TABLE "faturamento_diario" (
    "data_referencia" DATE NOT NULL,
    "comandas_pagas" INTEGER NOT NULL DEFAULT 0,
    "comandas_canceladas" INTEGER NOT NULL DEFAULT 0,
    "faturamento_subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_taxa_servico" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "faturamento_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "ticket_medio" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "por_forma_pagamento" JSONB NOT NULL DEFAULT '{"pix":"0.00","cartao":"0.00","dinheiro":"0.00"}',
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturamento_diario_pkey" PRIMARY KEY ("data_referencia")
);

-- CreateTable
CREATE TABLE "vendas_produto_abc" (
    "produto_id" INTEGER NOT NULL,
    "nome_produto" VARCHAR(140) NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "quantidade_vendida" INTEGER NOT NULL DEFAULT 0,
    "receita_gerada" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "classe_abc" CHAR(1) NOT NULL DEFAULT 'C',
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_produto_abc_pkey" PRIMARY KEY ("produto_id")
);

-- CreateTable
CREATE TABLE "desempenho_garcom" (
    "garcom_id" INTEGER NOT NULL,
    "nome_garcom" VARCHAR(120) NOT NULL,
    "comandas_atendidas" INTEGER NOT NULL DEFAULT 0,
    "vendas_subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxa_servico_gerada" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "ticket_medio_mesa" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desempenho_garcom_pkey" PRIMARY KEY ("garcom_id")
);

-- CreateTable
CREATE TABLE "alertas_estoque" (
    "produto_id" INTEGER NOT NULL,
    "nome" VARCHAR(140) NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "estoque_atual" INTEGER NOT NULL,
    "estoque_minimo" INTEGER NOT NULL,
    "nivel_criticidade" VARCHAR(20) NOT NULL,
    "ultimo_movimento_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_estoque_pkey" PRIMARY KEY ("produto_id")
);
