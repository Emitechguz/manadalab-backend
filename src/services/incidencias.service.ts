import type { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import type { UsuarioAutenticado } from "../types/http.types.js";
import type {
  crearIncidenciaSchema,
  consultaIncidenciasSchema,
  cambioEstadoSchema,
} from "../schemas/incidencias.schema.js";
import * as repositorio from "../repositories/incidencias.repository.js";
import { buscarDispositivo } from "../repositories/inventario.repository.js";
import {
  enTransaccion,
  bloquear,
  esConflictoConcurrente,
} from "../repositories/transaccion.js";
import { ErrorHttp } from "../helpers/error-http.js";
import { huella, cifrarMatricula } from "../helpers/seguridad.js";
import { esReportable } from "../helpers/catalogo.js";
import {
  alcanceIncidencias,
  exigirLecturaIncidencia,
  exigirCambioIncidencia,
} from "./permisos.service.js";
import { paginaRespuesta } from "../helpers/paginacion.js";

export async function consultarIncidencias(
  consulta: z.output<typeof consultaIncidenciasSchema>,
  usuario?: UsuarioAutenticado,
) {
  const filtros: Prisma.IncidenciaWhereInput = {
    ...(consulta.estado ? { estado: consulta.estado } : {}),
    dispositivo: {
      ...(consulta.emaId ? { emaId: consulta.emaId } : {}),
      ...(consulta.aulaId ? { aulaId: consulta.aulaId } : {}),
      ...(consulta.tipoId ? { tipoId: consulta.tipoId } : {}),
    },
  };
  const where = usuario ? { AND: [filtros, alcanceIncidencias(usuario)] } : filtros;
  const [datos, total] = await repositorio.listarIncidencias(
    where,
    consulta.pagina,
    consulta.limite,
  );
  return paginaRespuesta(datos, total, consulta);
}

export async function consultarDetalle(
  id: number | string,
  usuario?: UsuarioAutenticado,
) {
  if (!usuario) {
    const incidencia = await repositorio.detallePublico(id);
    if (!incidencia) throw new ErrorHttp(404, "El reporte no existe.");
    return incidencia;
  }
  const incidencia = await repositorio.buscarIncidencia(id);
  if (!incidencia) throw new ErrorHttp(404, "El reporte no existe.");
  exigirLecturaIncidencia(
    usuario,
    incidencia.dispositivo.emaId,
    incidencia.dispositivo.tipo.nombre,
  );
  return {
    ...incidencia,
    historial: await repositorio.historialIncidencia(incidencia.id),
  };
}

export async function registrarIncidencia(
  datos: z.output<typeof crearIncidenciaSchema>,
  clave: string,
) {
  const firma = huella(JSON.stringify(datos));
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await enTransaccion(async (transaccion) => {
        // La misma intención de alta espera y recupera el resultado confirmado.
        await bloquear("alta:" + clave, transaccion);
        const anterior = await repositorio.buscarReintento(clave, transaccion);
        if (anterior) {
          if (anterior.huella !== firma)
            throw new ErrorHttp(
              409,
              "La clave de reintento ya se utilizó con otro contenido.",
            );
          if (anterior.codigoHttp === null || anterior.respuesta === null)
            throw new ErrorHttp(
              409, "La operación todavía no está confirmada.",
            );
          return {
            codigo: anterior.codigoHttp,
            respuesta: anterior.respuesta,
            repetido: true,
          };
        }
        await repositorio.reservarReintento(clave, firma, transaccion);
        await bloquear("dispositivo:" + datos.dispositivoId, transaccion);
        const dispositivo = await buscarDispositivo(
          datos.dispositivoId, transaccion,
        );
        if (!dispositivo) throw new ErrorHttp(404, "El dispositivo no existe.");
        if (!esReportable(dispositivo.tipo.nombre) || !dispositivo.aulaId)
          throw new ErrorHttp(
            400, "El dispositivo no admite reportes de fallas.",
          );
        const activa = await repositorio.buscarActiva(
          dispositivo.id, transaccion,
        );
        const incidencia =
          activa ??
          (await repositorio.crearIncidencia(
            {
              dispositivoId: dispositivo.id,
              descripcion: datos.descripcion,
              matriculaCifrada: cifrarMatricula(datos.matricula),
            },
            transaccion,
          ));
        const codigo = activa ? 409 : 201;
        const respuesta = {
          mensaje: activa
            ? "El dispositivo ya tiene un reporte activo."
            : "Reporte registrado.",
          incidencia: JSON.parse(
            JSON.stringify(incidencia),
          ) as Prisma.InputJsonObject,
        };
        await repositorio.confirmarReintento(
          clave,
          codigo,
          respuesta,
          incidencia.id,
          transaccion,
        );
        return { codigo, respuesta, repetido: false };
      });
    } catch (error) {
      // Un conflicto revierte la transacción completa; el reintento usa una válida.
      if (esConflictoConcurrente(error) && intento < 2) continue;
      throw error;
    }
  }
  throw new ErrorHttp(
    409,
    "No se pudo confirmar el reporte. Vuelve a consultar el dispositivo.",
  );
}

export async function actualizarEstado(
  id: number | string,
  datos: z.output<typeof cambioEstadoSchema>,
  usuario: UsuarioAutenticado,
) {
  return enTransaccion(async (transaccion) => {
    const inicial = await repositorio.buscarIncidencia(id, transaccion);
    if (!inicial) throw new ErrorHttp(404, "El reporte no existe.");
    await bloquear("dispositivo:" + inicial.dispositivo.id, transaccion);
    const incidencia = await repositorio.buscarIncidencia(id, transaccion);
    if (!incidencia) throw new ErrorHttp(404, "El reporte no existe.");
    exigirCambioIncidencia(
      usuario,
      incidencia.dispositivo.emaId,
      incidencia.dispositivo.tipo.nombre,
    );
    const siguiente =
      incidencia.estado === "PENDIENTE"
        ? "VISTO"
        : incidencia.estado === "VISTO"
          ? "SOLUCIONADO"
          : null;
    if (datos.version !== incidencia.version || datos.estado !== siguiente)
      throw new ErrorHttp(
        409,
        "La versión o transición no es válida. Actualiza el reporte.",
      );
    const cambios = await repositorio.cambiarEstado(
      incidencia.id,
      datos.version,
      incidencia.estado,
      datos.estado,
      usuario.id,
      transaccion,
    );
    if (!cambios) throw new ErrorHttp(409, "Otro administrador actualizó el reporte.");
    return repositorio.buscarIncidencia(incidencia.id, transaccion);
  });
}
