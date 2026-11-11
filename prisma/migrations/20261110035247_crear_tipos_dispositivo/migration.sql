-- CreateTable
CREATE TABLE "tipos_dispositivo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "es_prestable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tipos_dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_dispositivo_nombre_key" ON "tipos_dispositivo"("nombre");
