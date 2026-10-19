-- AlterTable (aditiva): aceite versionado dos Termos de Uso e da Política de Privacidade (RNF-009)
ALTER TABLE "Usuario" ADD COLUMN "aceiteTermosVersao" TEXT,
ADD COLUMN "aceiteTermosEm" TIMESTAMPTZ(3);
