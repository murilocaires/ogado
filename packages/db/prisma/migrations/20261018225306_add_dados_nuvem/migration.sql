-- CreateEnum
CREATE TYPE "LoteTipo" AS ENUM ('compra', 'venda');

-- CreateEnum
CREATE TYPE "ModoPeso" AS ENUM ('total', 'medio', 'individual');

-- CreateEnum
CREATE TYPE "BaseArroba" AS ENUM ('vivo', 'carcaca');

-- CreateTable
CREATE TABLE "Lote" (
    "id" UUID NOT NULL,
    "fazendaId" UUID NOT NULL,
    "tipo" "LoteTipo" NOT NULL,
    "numero" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "data" DATE,
    "modo" "ModoPeso" NOT NULL,
    "qtd" DECIMAL(12,3) NOT NULL,
    "peso" DECIMAL(12,3) NOT NULL,
    "pesos" DECIMAL(12,3)[],
    "preco" DECIMAL(14,2) NOT NULL,
    "base" "BaseArroba" NOT NULL DEFAULT 'vivo',
    "aplicarDesconto" BOOLEAN NOT NULL DEFAULT false,
    "desconto" DECIMAL(7,6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cenario" (
    "id" UUID NOT NULL,
    "fazendaId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL,
    "entradas" JSONB NOT NULL,
    "variantes" JSONB NOT NULL,
    "parametros" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Cenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecriaEntrada" (
    "id" UUID NOT NULL,
    "fazendaId" UUID NOT NULL,
    "entradas" JSONB NOT NULL,
    "lotacaoInicial" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RecriaEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lote_fazendaId_updatedAt_idx" ON "Lote"("fazendaId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_fazendaId_tipo_numero_key" ON "Lote"("fazendaId", "tipo", "numero");

-- CreateIndex
CREATE INDEX "Cenario_fazendaId_criadoEm_idx" ON "Cenario"("fazendaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Cenario_fazendaId_updatedAt_idx" ON "Cenario"("fazendaId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecriaEntrada_fazendaId_key" ON "RecriaEntrada"("fazendaId");

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cenario" ADD CONSTRAINT "Cenario_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecriaEntrada" ADD CONSTRAINT "RecriaEntrada_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
