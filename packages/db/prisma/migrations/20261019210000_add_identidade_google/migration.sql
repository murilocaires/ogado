-- CreateTable (aditiva): identidade Google vinculada a um usuário (RF-001, RF-006)
CREATE TABLE "IdentidadeGoogle" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentidadeGoogle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentidadeGoogle_usuarioId_key" ON "IdentidadeGoogle"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentidadeGoogle_sub_key" ON "IdentidadeGoogle"("sub");

-- AddForeignKey
ALTER TABLE "IdentidadeGoogle" ADD CONSTRAINT "IdentidadeGoogle_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
