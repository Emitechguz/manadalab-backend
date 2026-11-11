import type { z } from "zod";
import type { Manejador } from "../types/http.types.js";
export function validarEntrada(
  esquema: z.ZodType,
  origen: "body" | "query" | "params" = "body",
): Manejador {
  return (solicitud, respuesta, siguiente) => {
    const resultado = esquema.safeParse(solicitud[origen]);
    if (!resultado.success) {
      respuesta
        .status(400)
        .json({
          mensaje: "Los datos recibidos no son válidos.",
          errores: resultado.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        });
      return;
    }
    respuesta.locals.entrada ??= {};
    respuesta.locals.entrada[origen] = resultado.data;
    siguiente();
  };
}
