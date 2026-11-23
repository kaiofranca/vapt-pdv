CREATE TABLE "outbox_eventos" (
    "id" UUID NOT NULL,
    "tipo_evento" VARCHAR(60) NOT NULL,
    "chave_agregado" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_em" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_pendentes_idx" ON "outbox_eventos"("status", "criado_em" ASC);
