BEGIN;

-- Mantém as lápides para sincronização, permitindo reutilizar o último número excluído.
CREATE UNIQUE INDEX "Lote_fazendaId_tipo_numero_ativo_key"
ON "Lote" ("fazendaId", "tipo", "numero") WHERE "deletedAt" IS NULL;

DROP INDEX "Lote_fazendaId_tipo_numero_key";

COMMIT;
