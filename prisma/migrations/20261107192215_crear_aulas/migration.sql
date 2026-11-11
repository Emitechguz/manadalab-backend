-- CreateTable
CREATE TABLE "aulas" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aulas_clave_key" ON "aulas"("clave");
