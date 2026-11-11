import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
export const camposPublicos = {
  id: true,
  folio: true,
  estado: true,
  creadaEn: true,
  actualizadaEn: true,
  dispositivo: {
    select: {
      id: true,
      clave: true,
      aulaId: true,
      emaId: true,
      tipo: { select: { id: true, nombre: true } },
      aula: { select: { numero: true } },
      ema: { select: { nombre: true } },
    },
  },
} satisfies Prisma.IncidenciaSelect;
export function buscarIncidencia(
  id: number | string,
  cliente: Prisma.TransactionClient = prisma,
) {
  return cliente.incidencia.findUnique({
    where: typeof id === "number" ? { id } : { folio: id },
    select: { ...camposPublicos, descripcion: true, version: true },
  });
}
export function detallePublico(id: number | string) {
  return prisma.incidencia.findUnique({
    where: typeof id === "number" ? { id } : { folio: id },
    select: camposPublicos,
  });
}
export function historialIncidencia(incidenciaId: number) {
  return prisma.historialIncidencia.findMany({
    where: { incidenciaId },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    select: {
      estadoAnterior: true,
      estadoNuevo: true,
      fecha: true,
      usuario: { select: { id: true, nombre: true } },
    },
  });
}
export function listarIncidencias(
  where: Prisma.IncidenciaWhereInput,
  pagina: number,
  limite: number,
) {
  return prisma.$transaction(
    [
      prisma.incidencia.findMany({
        where,
        select: camposPublicos,
        orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      prisma.incidencia.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
}
export function buscarActiva(
  dispositivoId: number,
  cliente: Prisma.TransactionClient,
) {
  return cliente.incidencia.findFirst({
    where: { dispositivoId, estado: { in: ["PENDIENTE", "VISTO"] } },
    select: camposPublicos,
  });
}
export function crearIncidencia(
  datos: {
    dispositivoId: number;
    descripcion: string;
    matriculaCifrada: string;
  },
  cliente: Prisma.TransactionClient,
) {
  return cliente.incidencia.create({
    data: { ...datos, historial: { create: { estadoNuevo: "PENDIENTE" } } },
    select: camposPublicos,
  });
}
export function buscarReintento(
  clave: string,
  cliente: Prisma.TransactionClient,
) {
  return cliente.reintentoAlta.findUnique({ where: { clave } });
}
export function reservarReintento(
  clave: string,
  huella: string,
  cliente: Prisma.TransactionClient,
) {
  return cliente.reintentoAlta.create({ data: { clave, huella } });
}
export function confirmarReintento(
  clave: string,
  codigoHttp: number,
  respuesta: Prisma.InputJsonObject,
  incidenciaId: number,
  cliente: Prisma.TransactionClient,
) {
  return cliente.reintentoAlta.update({
    where: { clave },
    data: { codigoHttp, respuesta, incidenciaId },
  });
}
export function cambiarEstado(
  id: number,
  version: number,
  anterior: "PENDIENTE" | "VISTO" | "SOLUCIONADO",
  nuevo: "VISTO" | "SOLUCIONADO",
  usuarioId: number,
  cliente: Prisma.TransactionClient,
) {
  return cliente.incidencia
    .updateMany({
      where: { id, version, estado: anterior },
      data: { estado: nuevo, version: { increment: 1 } },
    })
    .then(async (resultado) => {
      if (resultado.count)
        await cliente.historialIncidencia.create({
          data: {
            incidenciaId: id,
            usuarioId,
            estadoAnterior: anterior,
            estadoNuevo: nuevo,
          },
        });
      return resultado.count;
    });
}
