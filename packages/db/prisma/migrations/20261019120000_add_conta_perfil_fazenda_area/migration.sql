-- AlterTable (aditiva): nome do perfil (RF-004) e área da fazenda em hectares (RF-011)
ALTER TABLE "Usuario" ADD COLUMN "nome" TEXT;
ALTER TABLE "Fazenda" ADD COLUMN "areaHa" DECIMAL(12,2);
