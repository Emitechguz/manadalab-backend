import { consultaAulasSchema } from "../schemas/aulas.schema.js";
import type { ManejadorConsultaAulas } from "../types/aulas.types.js";

export const validarConsultaAulas: ManejadorConsultaAulas = (
  solicitud,
  respuesta,
  siguiente,
) => {
  const resultado = consultaAulasSchema.safeParse(solicitud.query);

  if (!resultado.success) {
    respuesta.status(400).json({
      mensaje: "Los parámetros de consulta no son válidos.",
      errores: resultado.error.issues.map((problema) => ({
        campo: problema.path.join("."),
        mensaje: problema.message,
      })),
    });
    return;
  }

  respuesta.locals.consultaAulas = resultado.data;
  siguiente();
};
