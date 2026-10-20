CREATE TABLE "HistoricoSync" (
  "id" UUID NOT NULL,
  "fazendaId" UUID NOT NULL,
  "entidadeId" UUID NOT NULL,
  "tipo" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "local" JSONB NOT NULL,
  "servidor" JSONB NOT NULL,
  "resultado" JSONB NOT NULL,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoSync_pkey" PRIMARY KEY ("fazendaId", "id"),
  CONSTRAINT "HistoricoSync_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HistoricoSync_fazendaId_entidadeId_criadoEm_idx" ON "HistoricoSync"("fazendaId", "entidadeId", "criadoEm");
