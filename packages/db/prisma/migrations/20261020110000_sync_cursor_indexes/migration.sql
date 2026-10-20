-- RF-074 / ARQ-05: cursor estável sem remover índices usados por clientes anteriores.
CREATE INDEX "Lote_fazendaId_updatedAt_id_idx" ON "Lote"("fazendaId", "updatedAt", "id");
CREATE INDEX "Cenario_fazendaId_updatedAt_id_idx" ON "Cenario"("fazendaId", "updatedAt", "id");
