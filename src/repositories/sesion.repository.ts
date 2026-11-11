import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
export function buscarUsuario(correo: string) {
  return prisma.usuario.findUnique({ where: { correo } });
}
export function crearSesion(datos: Prisma.SesionUncheckedCreateInput) {
  return prisma.sesion.create({ data: datos });
}
export function buscarSesion(id: string) {
  return prisma.sesion.findUnique({
    where: { id },
    include: {
      usuario: {
        select: {
          id: true,
          nombre: true,
          correo: true,
          emaId: true,
          esTecnico: true,
          activo: true,
        },
      },
    },
  });
}
export function revocarSesion(id: string) {
  return prisma.sesion.updateMany({
    where: { id, revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}
