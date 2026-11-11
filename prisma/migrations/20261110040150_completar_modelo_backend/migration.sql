-- CreateEnum
CREATE TYPE "estado_incidencia" AS ENUM ('pendiente', 'visto', 'solucionado');

-- CreateTable
CREATE TABLE "dispositivos" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "ema_id" INTEGER NOT NULL,
    "aula_id" INTEGER,

    CONSTRAINT "dispositivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasena_hash" TEXT NOT NULL,
    "ema_id" INTEGER NOT NULL,
    "es_tecnico" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamos" (
    "id" SERIAL NOT NULL,
    "dispositivo_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "profesor_nombre" TEXT NOT NULL,
    "fecha_prestamo" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_devolucion" TIMESTAMPTZ(3),

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias" (
    "id" SERIAL NOT NULL,
    "folio" UUID NOT NULL,
    "dispositivo_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "matricula_cifrada" TEXT NOT NULL,
    "estado" "estado_incidencia" NOT NULL DEFAULT 'pendiente',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_incidencias" (
    "id" SERIAL NOT NULL,
    "incidencia_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "estado_anterior" "estado_incidencia",
    "estado_nuevo" "estado_incidencia" NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocada_en" TIMESTAMPTZ(3),

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reintentos_alta" (
    "clave" UUID NOT NULL,
    "huella" TEXT NOT NULL,
    "codigo_http" INTEGER,
    "respuesta" JSONB,
    "incidencia_id" INTEGER,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reintentos_alta_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_clave_key" ON "dispositivos"("clave");

-- CreateIndex
CREATE INDEX "dispositivos_tipo_id_idx" ON "dispositivos"("tipo_id");

-- CreateIndex
CREATE INDEX "dispositivos_ema_id_idx" ON "dispositivos"("ema_id");

-- CreateIndex
CREATE INDEX "dispositivos_aula_id_ema_id_idx" ON "dispositivos"("aula_id", "ema_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "usuarios_ema_id_idx" ON "usuarios"("ema_id");

-- CreateIndex
CREATE INDEX "prestamos_dispositivo_id_idx" ON "prestamos"("dispositivo_id");

-- CreateIndex
CREATE INDEX "prestamos_admin_id_fecha_prestamo_idx" ON "prestamos"("admin_id", "fecha_prestamo");

-- CreateIndex
CREATE UNIQUE INDEX "incidencias_folio_key" ON "incidencias"("folio");

-- CreateIndex
CREATE INDEX "incidencias_dispositivo_id_estado_idx" ON "incidencias"("dispositivo_id", "estado");

-- CreateIndex
CREATE INDEX "incidencias_estado_creada_en_idx" ON "incidencias"("estado", "creada_en");

-- CreateIndex
CREATE INDEX "historial_incidencias_incidencia_id_fecha_idx" ON "historial_incidencias"("incidencia_id", "fecha");

-- CreateIndex
CREATE INDEX "historial_incidencias_usuario_id_idx" ON "historial_incidencias"("usuario_id");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_idx" ON "sesiones"("usuario_id");

-- CreateIndex
CREATE INDEX "sesiones_expira_en_idx" ON "sesiones"("expira_en");

-- CreateIndex
CREATE INDEX "reintentos_alta_incidencia_id_idx" ON "reintentos_alta"("incidencia_id");

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_ema_id_fkey" FOREIGN KEY ("ema_id") REFERENCES "emas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_aula_id_ema_id_fkey" FOREIGN KEY ("aula_id", "ema_id") REFERENCES "aulas"("id", "ema_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_ema_id_fkey" FOREIGN KEY ("ema_id") REFERENCES "emas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_incidencias" ADD CONSTRAINT "historial_incidencias_incidencia_id_fkey" FOREIGN KEY ("incidencia_id") REFERENCES "incidencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_incidencias" ADD CONSTRAINT "historial_incidencias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reintentos_alta" ADD CONSTRAINT "reintentos_alta_incidencia_id_fkey" FOREIGN KEY ("incidencia_id") REFERENCES "incidencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Un solo préstamo pendiente por dispositivo
CREATE UNIQUE INDEX "prestamos_pendiente_dispositivo_key"
ON "prestamos" ("dispositivo_id")
WHERE "fecha_devolucion" IS NULL;

-- Una sola incidencia activa por dispositivo
CREATE UNIQUE INDEX "incidencias_activa_dispositivo_key"
ON "incidencias" ("dispositivo_id")
WHERE "estado" IN ('pendiente', 'visto');

-- La devolución no puede ser anterior al préstamo
ALTER TABLE "prestamos"
ADD CONSTRAINT "prestamos_fechas_check"
CHECK (
  "fecha_devolucion" IS NULL
  OR "fecha_devolucion" >= "fecha_prestamo"
);

-- La versión de una incidencia comienza en 1
ALTER TABLE "incidencias"
ADD CONSTRAINT "incidencias_version_check"
CHECK ("version" >= 1);

-- La actualización no puede ser anterior a la creación
ALTER TABLE "incidencias"
ADD CONSTRAINT "incidencias_fechas_check"
CHECK ("actualizada_en" >= "creada_en");

-- Fechas coherentes para las sesiones
ALTER TABLE "sesiones"
ADD CONSTRAINT "sesiones_fechas_check"
CHECK (
  "expira_en" > "creada_en"
  AND (
    "revocada_en" IS NULL
    OR "revocada_en" >= "creada_en"
  )
);

-- Un reintento está reservado o contiene un resultado completo
ALTER TABLE "reintentos_alta"
ADD CONSTRAINT "reintentos_alta_resultado_check"
CHECK (
  (
    "codigo_http" IS NULL
    AND "respuesta" IS NULL
    AND "incidencia_id" IS NULL
  )
  OR
  (
    "codigo_http" IS NOT NULL
    AND "codigo_http" IN (201, 409)
    AND "respuesta" IS NOT NULL
    AND jsonb_typeof("respuesta") = 'object'
    AND "incidencia_id" IS NOT NULL
  )
);