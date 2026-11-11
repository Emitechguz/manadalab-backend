import type { z } from "zod";
import type { Manejador } from "../types/http.types.js";
import {
  parametrosIncidencia,
  consultaIncidenciasSchema,
  crearIncidenciaSchema,
  cambioEstadoSchema,
  claveReintentoSchema,
} from "../schemas/incidencias.schema.js";
import * as servicio from "../services/incidencias.service.js";
import { ErrorHttp } from "../helpers/error-http.js";
export const listarPublicas: Manejador = async (_solicitud, respuesta) => {
  respuesta.json(
    await servicio.consultarIncidencias(
      respuesta.locals.entrada.query as z.output<
        typeof consultaIncidenciasSchema
      >,
    ),
  );
};
export const listarPrivadas: Manejador = async (_solicitud, respuesta) => {
  respuesta.json(
    await servicio.consultarIncidencias(
      respuesta.locals.entrada.query as z.output<
        typeof consultaIncidenciasSchema
      >,
      respuesta.locals.usuario,
    ),
  );
};
export const detallePublico: Manejador = async (_solicitud, respuesta) => {
  const { id } = respuesta.locals.entrada.params as z.output<
    typeof parametrosIncidencia
  >;
  respuesta.json(await servicio.consultarDetalle(id));
};
export const detallePrivado: Manejador = async (_solicitud, respuesta) => {
  const { id } = respuesta.locals.entrada.params as z.output<
    typeof parametrosIncidencia
  >;
  respuesta.json(await servicio.consultarDetalle(id, respuesta.locals.usuario));
};
export const registrar: Manejador = async (solicitud, respuesta) => {
  const clave = claveReintentoSchema.safeParse(
    solicitud.get("idempotency-key"),
  );
  if (!clave.success)
    throw new ErrorHttp(400, "Envía Idempotency-Key con un UUID válido.");
  const resultado = await servicio.registrarIncidencia(
    respuesta.locals.entrada.body as z.output<typeof crearIncidenciaSchema>,
    clave.data,
  );
  respuesta.set("Cache-Control", "no-store");
  respuesta.set("Idempotency-Replayed", String(resultado.repetido));
  respuesta.status(resultado.codigo).json(resultado.respuesta);
};
export const cambiarEstado: Manejador = async (_solicitud, respuesta) => {
  const { id } = respuesta.locals.entrada.params as z.output<
    typeof parametrosIncidencia
  >;
  respuesta.json(
    await servicio.actualizarEstado(
      id,
      respuesta.locals.entrada.body as z.output<typeof cambioEstadoSchema>,
      respuesta.locals.usuario,
    ),
  );
};
