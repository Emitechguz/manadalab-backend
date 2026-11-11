/*
  Warnings:

  - A unique constraint covering the columns `[ema_id,clave]` on the table `aulas` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ema_id` to the `aulas` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "aulas_clave_key";

-- AlterTable
ALTER TABLE "aulas" ADD COLUMN     "ema_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "emas" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,

    CONSTRAINT "emas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emas_clave_key" ON "emas"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_ema_id_clave_key" ON "aulas"("ema_id", "clave");

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_ema_id_fkey" FOREIGN KEY ("ema_id") REFERENCES "emas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
