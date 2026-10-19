-- CreateTable (aditiva): token de redefinição de senha (RF-002); só o SHA-256 do token é guardado
CREATE TABLE "TokenRedefinicao" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "TokenRedefinicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenRedefinicao_tokenHash_key" ON "TokenRedefinicao"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRedefinicao_usuarioId_idx" ON "TokenRedefinicao"("usuarioId");

-- AddForeignKey
ALTER TABLE "TokenRedefinicao" ADD CONSTRAINT "TokenRedefinicao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
