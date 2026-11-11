import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler } from "express";
import { ErrorHttp } from "../helpers/error-http.js";
import { Prisma } from "../generated/prisma/client.js";
export const manejarErrores: ErrorRequestHandler = (
  error: unknown,
  _solicitud,
  respuesta,
  siguiente,
) => {
  if (respuesta.headersSent) {
    siguiente(error);
    return;
  }
  if (error instanceof ErrorHttp) {
    respuesta
      .status(error.estado)
      .json({
        mensaje: error.message,
        ...(error.detalles === undefined ? {} : { detalles: error.detalles }),
      });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    respuesta.status(400).json({ mensaje: "El cuerpo JSON no es válido." });
    return;
  }
  if (typeof error === "object" && error !== null && "type" in error) {
    if (error.type === "entity.too.large") {
      respuesta
        .status(413)
        .json({ mensaje: "El cuerpo excede el tamaño permitido." });
      return;
    }
    if (
      error.type === "encoding.unsupported" ||
      error.type === "charset.unsupported"
    ) {
      respuesta.status(415).json({ mensaje: "Codificación no admitida." });
      return;
    }
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2003", "P2025", "P2034"].includes(error.code)
  ) {
    respuesta
      .status(409)
      .json({
        mensaje:
          "Los datos cambiaron o entran en conflicto. Actualiza la información.",
      });
    return;
  }
  const idError = randomUUID();
  console.error(
    JSON.stringify({
      idError,
      evento: "error_peticion",
      clase: error instanceof Error ? error.name : "desconocido",
      ...(error instanceof Prisma.PrismaClientKnownRequestError
        ? { codigo: error.code }
        : {}),
    }),
  );
  respuesta.status(500).json({ mensaje: "Ocurrió un error interno.", idError });
};
