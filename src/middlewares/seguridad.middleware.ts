import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { RequestHandler } from "express";
import { env, nombreCookie } from "../config/env.js";
import { ErrorHttp } from "../helpers/error-http.js";
import { huella, iguales } from "../helpers/seguridad.js";
import { autenticar } from "../services/sesion.service.js";
import type { Manejador } from "../types/http.types.js";

export const exigirOrigen: RequestHandler = (
  solicitud, _respuesta, siguiente,
) => {
  if (
    solicitud.get("origin") !== env.origen ||
    solicitud.get("sec-fetch-site") === "cross-site"
  ) {
    throw new ErrorHttp(403, "El origen de la petición no está permitido.");
  }
  siguiente();
};
export const exigirJson: RequestHandler = (
  solicitud, _respuesta, siguiente,
) => {
  if (!solicitud.is("application/json"))
    throw new ErrorHttp(415, "Utiliza Content-Type: application/json.");
  siguiente();
};
export const exigirSesion: Manejador = async (
  solicitud, respuesta, siguiente,
) => {
  const sesion = await autenticar(solicitud.cookies?.[nombreCookie]);
  respuesta.set("Cache-Control", "no-store");
  respuesta.locals.usuario = sesion.usuario;
  respuesta.locals.sesionId = sesion.id;
  respuesta.locals.csrfHash = sesion.csrfHash;
  siguiente();
};
export const exigirCsrf: Manejador = (solicitud, respuesta, siguiente) => {
  const token = solicitud.get("x-csrf-token");
  if (
    !token || token.length > 256 || !iguales(huella(token), respuesta.locals.csrfHash)
  )
    throw new ErrorHttp(403, "Token CSRF ausente o inválido.");
  siguiente();
};
const mensajeLimite = {
  mensaje: "Demasiadas peticiones. Intenta de nuevo más tarde.",
};
export const limiteGeneral = rateLimit({
  windowMs: 60000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: mensajeLimite,
});
export const limiteAccesoIp = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: mensajeLimite,
});
export const limiteAccesoCuenta = rateLimit({
  windowMs: 15 * 60000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: mensajeLimite,
  keyGenerator: (solicitud) =>
    huella("acceso:" + String(solicitud.body?.correo ?? "").toLowerCase()),
});
export const limiteAltas = rateLimit({
  windowMs: 15 * 60000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: mensajeLimite,
  keyGenerator: (solicitud) =>
    ipKeyGenerator(solicitud.ip ?? solicitud.socket.remoteAddress ?? "local"),
});
export const limiteDispositivo = rateLimit({
  windowMs: 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: mensajeLimite,
  keyGenerator: (solicitud) =>
    "dispositivo:" + String(solicitud.body?.dispositivoId ?? "invalido"),
});
