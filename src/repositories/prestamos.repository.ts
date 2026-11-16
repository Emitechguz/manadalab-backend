import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

const campos = {
  id: true,
  profesorNombre: true,
  fechaPrestamo: true,
  fechaDevolucion: true,
  admin: { select: { id: true, nombre: true } },
  dispositivo: {
    select: {
      id: true,
      clave: true,
      emaId: true,
      aulaId: true,
      tipo: { select: { nombre: true } },
    },
  },
} satisfies Prisma.PrestamoSelect;

export function listarPrestamos(
  where: Prisma.PrestamoWhereInput,
  pagina: number,
  limite: number,
) {
  return prisma.$transaction(
    [
      prisma.prestamo.findMany({
        where,
        select: campos,
        orderBy: [{ fechaPrestamo: "desc" }, { id: "desc" }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      prisma.prestamo.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
}
export const buscarPrestamo = (
  id: number, cliente: Prisma.TransactionClient = prisma,
) =>
  cliente.prestamo.findUnique({ where: { id }, select: campos });
export const prestamoPendiente = (
  dispositivoId: number,
  cliente: Prisma.TransactionClient,
) =>
  cliente.prestamo.findFirst({
    where: { dispositivoId, fechaDevolucion: null },
    select: { id: true },
  });
export const crearPrestamo = (
  datos: { dispositivoId: number; adminId: number; profesorNombre: string },
  cliente: Prisma.TransactionClient,
) => cliente.prestamo.create({ data: datos, select: campos });
export const devolverPrestamo = (
  id: number, cliente: Prisma.TransactionClient,
) =>
  cliente.prestamo.updateMany({
    where: { id, fechaDevolucion: null },
    data: { fechaDevolucion: new Date() },
  });
