import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { tiposDispositivo } from "../helpers/catalogo.js";

export const buscarDispositivo = (
  id: number,
  cliente: Prisma.TransactionClient = prisma,
) =>
  cliente.dispositivo.findUnique({
    where: { id },
    include: { tipo: true, aula: true },
  });
export const buscarAula = (id: number) =>
  prisma.aula.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      emaId: true,
      ema: { select: { nombre: true } },
    },
  });

export function listarRecursos(aulaId: number, pagina: number, limite: number) {
  const where = {
    aulaId,
    tipo: {
      nombre: {
        in: tiposDispositivo.filter((t) => !t.esPrestable).map((t) => t.nombre),
      },
    },
  };
  return prisma.$transaction(
    [
      prisma.dispositivo.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { id: "asc" },
        select: {
          id: true,
          clave: true,
          tipo: { select: { id: true, nombre: true } },
          incidencias: {
            where: { estado: { in: ["PENDIENTE", "VISTO"] } },
            select: { id: true, folio: true, estado: true, creadaEn: true },
            take: 1,
          },
        },
      }),
      prisma.dispositivo.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
}

export function listarEmas(pagina: number, limite: number) {
  return prisma.$transaction(
    [
      prisma.ema.findMany({
        select: { id: true, nombre: true },
        orderBy: { id: "asc" },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      prisma.ema.count(),
    ],
    { isolationLevel: "RepeatableRead" },
  );
}

export function listarPrestables(
  emaId: number, pagina: number, limite: number,
) {
  const where = {
    emaId,
    tipo: { esPrestable: true },
    prestamos: { none: { fechaDevolucion: null } },
  };
  return prisma.$transaction(
    [
      prisma.dispositivo.findMany({
        where,
        select: {
          id: true,
          clave: true,
          aulaId: true,
          tipo: { select: { nombre: true } },
        },
        orderBy: { id: "asc" },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      prisma.dispositivo.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
}
