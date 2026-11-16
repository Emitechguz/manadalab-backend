import type { z } from "zod";
import type { Manejador } from "../types/http.types.js";
import type { parametrosId, paginacionSchema, } from "../schemas/comunes.schema.js";
import type {
  consultaPrestamosSchema,
  nuevoPrestamoSchema,
} from "../schemas/prestamos.schema.js";
import * as servicio from "../services/prestamos.service.js";
import { consultarPrestables } from "../services/inventario.service.js";

export const listar: Manejador = async (_solicitud, respuesta) => {
  respuesta.json(
    await servicio.consultarPrestamos(
      respuesta.locals.entrada.query as z.output<
        typeof consultaPrestamosSchema
      >,
      respuesta.locals.usuario,
    ),
  );
};
export const detalle: Manejador = async (_solicitud, respuesta) => {
  const { id } = respuesta.locals.entrada.params as z.output<
    typeof parametrosId
  >;
  respuesta.json(await servicio.detallePrestamo(id, respuesta.locals.usuario));
};
export const crear: Manejador = async (_solicitud, respuesta) => {
  respuesta
    .status(201)
    .json(
      await servicio.registrarPrestamo(
        respuesta.locals.entrada.body as z.output<typeof nuevoPrestamoSchema>,
        respuesta.locals.usuario,
      ),
    );
};
export const devolver: Manejador = async (_solicitud, respuesta) => {
  const { id } = respuesta.locals.entrada.params as z.output<
    typeof parametrosId
  >;
  respuesta.json(
    await servicio.registrarDevolucion(id, respuesta.locals.usuario),
  );
};
export const disponibles: Manejador = async (_solicitud, respuesta) => {
  respuesta.json(
    await consultarPrestables(
      respuesta.locals.usuario.emaId,
      respuesta.locals.entrada.query as z.output<typeof paginacionSchema>,
    ),
  );
};
