import type { RequestHandler } from "express";

export const manejarRutaNoEncontrada: RequestHandler = (
  _solicitud, respuesta,
) => {
  respuesta.status(404).json({
    mensaje: "La ruta solicitada no existe.",
  });
};
