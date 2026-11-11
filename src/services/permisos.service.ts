import { esComputadora } from "../helpers/catalogo.js";
import { ErrorHttp } from "../helpers/error-http.js";
import type { UsuarioAutenticado } from "../types/http.types.js";
import type { Prisma } from "../generated/prisma/client.js";

export function alcanceIncidencias(
  usuario: UsuarioAutenticado,
): Prisma.IncidenciaWhereInput {
  return usuario.esTecnico
    ? {
        OR: [
          { dispositivo: { emaId: usuario.emaId } },
          { dispositivo: { tipo: { nombre: "Computadora" } } },
        ],
      }
    : { dispositivo: { emaId: usuario.emaId } };
}
export function exigirLecturaIncidencia(
  usuario: UsuarioAutenticado,
  emaId: number,
  tipo: string,
) {
  if (usuario.emaId !== emaId && !(usuario.esTecnico && esComputadora(tipo)))
    throw new ErrorHttp(403, "No tienes acceso a este reporte.");
}
export function exigirCambioIncidencia(
  usuario: UsuarioAutenticado,
  emaId: number,
  tipo: string,
) {
  if (esComputadora(tipo) ? !usuario.esTecnico : usuario.emaId !== emaId)
    throw new ErrorHttp(403, "No puedes cambiar el estado de este reporte.");
}
export function exigirEmaPropio(usuario: UsuarioAutenticado, emaId: number) {
  if (usuario.emaId !== emaId)
    throw new ErrorHttp(403, "La operación corresponde a otro EMA.");
}
