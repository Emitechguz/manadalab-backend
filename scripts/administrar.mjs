import "dotenv/config";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import argon2 from "argon2";
import { prisma } from "../dist/config/prisma.js";
import { tiposDispositivo } from "../dist/helpers/catalogo.js";

const texto = z.string().trim().min(1).max(150);
const inventarioSchema = z
  .array(
    z.strictObject({
      nombre: texto,
      aulas: z
        .array(z.strictObject({ numero: z.string().trim().min(1).max(30) }))
        .default([]),
      dispositivos: z
        .array(
          z.strictObject({
            clave: z.string().trim().min(1).max(100),
            tipo: z.enum(tiposDispositivo.map((t) => t.nombre)),
            aula: z.string().trim().min(1).max(30).nullable(),
          }),
        )
        .default([]),
    }),
  )
  .min(1);

async function cargarCatalogo(transaccion) {
  for (const tipo of tiposDispositivo) {
    const existente = await transaccion.tipoDispositivo.findUnique({
      where: { nombre: tipo.nombre },
    });
    if (existente && existente.esPrestable !== tipo.esPrestable)
      throw new Error("El catálogo existente no coincide con las reglas.");
    await transaccion.tipoDispositivo.upsert({
      where: { nombre: tipo.nombre },
      create: tipo,
      update: {},
    });
  }
}
async function ejecutar() {
  const comando = process.argv[2];
  if (comando === "catalogo") {
    await prisma.$transaction(cargarCatalogo);
  } else if (comando === "inventario") {
    if (!process.argv[3])
      throw new Error("Indica la ruta del JSON con el inventario real.");
    const inventario = inventarioSchema.parse(
      JSON.parse(await readFile(process.argv[3], "utf8")),
    );
    await prisma.$transaction(
      async (transaccion) => {
        await cargarCatalogo(transaccion);
        for (const elemento of inventario) {
          const ema = await transaccion.ema.upsert({
            where: { nombre: elemento.nombre },
            create: { nombre: elemento.nombre },
            update: {},
          });
          for (const aula of elemento.aulas) {
            await transaccion.aula.upsert({
              where: { emaId_numero: { emaId: ema.id, numero: aula.numero } },
              create: { emaId: ema.id, numero: aula.numero },
              update: {},
            });
          }
          for (const unidad of elemento.dispositivos) {
            if (unidad.aula === null && unidad.tipo !== "Antena Wi-Fi")
              throw new Error("Solo las antenas pueden carecer de aula.");
            const tipo = await transaccion.tipoDispositivo.findUniqueOrThrow({
              where: { nombre: unidad.tipo },
            });
            const aula =
              unidad.aula === null
                ? null
                : await transaccion.aula.findUniqueOrThrow({
                    where: {
                      emaId_numero: { emaId: ema.id, numero: unidad.aula },
                    },
                  });
            const datos = {
              clave: unidad.clave,
              tipoId: tipo.id,
              emaId: ema.id,
              aulaId: aula?.id ?? null,
            };
            const existente = await transaccion.dispositivo.findUnique({
              where: { clave: unidad.clave },
            });
            if (
              existente &&
              (existente.emaId !== datos.emaId ||
                existente.tipoId !== datos.tipoId ||
                existente.aulaId !== datos.aulaId)
            ) {
              throw new Error(
                "Una clave de dispositivo existente tiene otra asignación. No se modificó el inventario.",
              );
            }
            if (!existente)
              await transaccion.dispositivo.create({ data: datos });
          }
        }
      },
      { timeout: 300000 },
    );
  } else if (comando === "usuario") {
    const datos = z
      .object({
        ADMIN_NOMBRE: texto,
        ADMIN_CORREO: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        ADMIN_EMA_ID: z.coerce.number().int().positive(),
        ADMIN_ES_TECNICO: z.enum(["true", "false"]).default("false"),
        ADMIN_PASSWORD: z.string().min(12).max(128),
      })
      .parse(process.env);
    const ema =
      (await prisma.ema.findUnique({ where: { id: datos.ADMIN_EMA_ID } })) ??
      (await prisma.ema.findFirstOrThrow());
    const contrasenaHash = await argon2.hash(datos.ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await prisma.usuario.create({
      data: {
        nombre: datos.ADMIN_NOMBRE,
        correo: datos.ADMIN_CORREO,
        emaId: ema.id,
        esTecnico: datos.ADMIN_ES_TECNICO === "true",
        contrasenaHash,
      },
    });
  } else if (comando === "deshabilitar") {
    const correo = z.email().parse(process.argv[3]).toLowerCase();
    await prisma.$transaction(async (transaccion) => {
      const usuario = await transaccion.usuario.update({
        where: { correo },
        data: { activo: false },
      });
      await transaccion.sesion.updateMany({
        where: { usuarioId: usuario.id, revocadaEn: null },
        data: { revocadaEn: new Date() },
      });
    });
  } else {
    throw new Error(
      "Uso: administrar catalogo | inventario archivo.json | usuario | deshabilitar correo",
    );
  }
  console.log("Operación administrativa completada.");
}
ejecutar()
  .catch((error) => {
    if (error instanceof z.ZodError)
      console.error(
        "Entrada inválida: " +
          error.issues.map((i) => i.path.join(".")).join(", "),
      );
    else
      console.error(
        error instanceof Error
          ? error.message
          : "Operación rechazada: revisa los datos y las relaciones existentes.",
      );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
