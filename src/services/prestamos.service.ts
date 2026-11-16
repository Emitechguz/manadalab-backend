import type { z } from "zod";
import type { UsuarioAutenticado } from "../types/http.types.js";
import type {
  consultaPrestamosSchema,
  nuevoPrestamoSchema,
} from "../schemas/prestamos.schema.js";
import * as repositorio from "../repositories/prestamos.repository.js";
import { buscarDispositivo } from "../repositories/inventario.repository.js";
import { enTransaccion, bloquear } from "../repositories/transaccion.js";
import { exigirEmaPropio } from "./permisos.service.js";
import { ErrorHttp } from "../helpers/error-http.js";
import { paginaRespuesta } from "../helpers/paginacion.js";

export async function consultarPrestamos(
  consulta: z.output<typeof consultaPrestamosSchema>,
  usuario: UsuarioAutenticado,
) {
  const [datos, total] = await repositorio.listarPrestamos(
    {
      dispositivo: { emaId: usuario.emaId },
      ...(consulta.dispositivoId ? { dispositivoId: consulta.dispositivoId } : {}),
      ...(consulta.estado === "PENDIENTE"
        ? { fechaDevolucion: null }
        : consulta.estado === "DEVUELTO"
          ? { fechaDevolucion: { not: null } }
          : {}),
    },
    consulta.pagina,
    consulta.limite,
  );
  return paginaRespuesta(datos, total, consulta);
}

export async function detallePrestamo(id: number, usuario: UsuarioAutenticado) {
  const prestamo = await repositorio.buscarPrestamo(id);
  if (!prestamo) throw new ErrorHttp(404, "El préstamo no existe.");
  exigirEmaPropio(usuario, prestamo.dispositivo.emaId);
  return prestamo;
}

export async function registrarPrestamo(
  datos: z.output<typeof nuevoPrestamoSchema>,
  usuario: UsuarioAutenticado,
) {
  return enTransaccion(async (transaccion) => {
    await bloquear("dispositivo:" + datos.dispositivoId, transaccion);
    const dispositivo = await buscarDispositivo(
      datos.dispositivoId, transaccion,
    );
    if (!dispositivo) throw new ErrorHttp(404, "El dispositivo no existe.");
    exigirEmaPropio(usuario, dispositivo.emaId);
    if (!dispositivo.tipo.esPrestable)
      throw new ErrorHttp(400, "Este dispositivo no es prestable.");
    if (await repositorio.prestamoPendiente(dispositivo.id, transaccion))
      throw new ErrorHttp(
        409, "El dispositivo ya tiene un préstamo pendiente.",
      );
    return repositorio.crearPrestamo(
      { ...datos, adminId: usuario.id }, transaccion,
    );
  });
}

export async function registrarDevolucion(
  id: number, usuario: UsuarioAutenticado,
) {
  return enTransaccion(async (transaccion) => {
    const inicial = await repositorio.buscarPrestamo(id, transaccion);
    if (!inicial) throw new ErrorHttp(404, "El préstamo no existe.");
    await bloquear("dispositivo:" + inicial.dispositivo.id, transaccion);
    const prestamo = await repositorio.buscarPrestamo(id, transaccion);
    if (!prestamo) throw new ErrorHttp(404, "El préstamo no existe.");
    exigirEmaPropio(usuario, prestamo.dispositivo.emaId);
    await repositorio.devolverPrestamo(id, transaccion);
    return repositorio.buscarPrestamo(id, transaccion);
  });
}
