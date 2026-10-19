-- Aditiva (ADR-0013): desconto da venda passa de fração (%) para kg por cabeça.
-- A coluna antiga "desconto" é mantida (legado, sem leitura/escrita); removê-la exige ADR própria.
ALTER TABLE "Lote" ADD COLUMN "descontoKg" DECIMAL(8,3);

-- Lotes de venda com desconto ligado: o antigo 10% (ou qualquer outra fração) vira 10 kg/cab.
-- Decisão do dono (2026-10-19): o padrão é 10 kg por cabeça, não um percentual. Os demais ficam NULL
-- (venda sem desconto, ou compra) e o cliente usa o padrão quando o desconto está ligado.
UPDATE "Lote" SET "descontoKg" = 10 WHERE "tipo" = 'venda' AND "aplicarDesconto" = true;
