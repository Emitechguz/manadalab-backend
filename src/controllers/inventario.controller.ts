import type { z } from "zod";
import type { Manejador } from "../types/http.types.js";
import type { parametrosId } from "../schemas/comunes.schema.js";
import type { paginacionSchema } from "../schemas/comunes.schema.js";
import { recursosAula, consultarEmas } from "../services/inventario.service.js";
export const recursos: Manejador = async (_solicitud, respuesta) => {
  const { id } = respuesta.locals.entrada.params as z.output<
    typeof parametrosId
  >;
  respuesta.json(
    await recursosAula(
      id,
      respuesta.locals.entrada.query as z.output<typeof paginacionSchema>,
    ),
  );
};
export const emas: Manejador = async (_solicitud, respuesta) => {
  respuesta.json(
    await consultarEmas(
      respuesta.locals.entrada.query as z.output<typeof paginacionSchema>,
    ),
  );
};
