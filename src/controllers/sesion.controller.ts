import type { z } from "zod";
import { accesoSchema } from "../schemas/sesion.schema.js";
import * as servicio from "../services/sesion.service.js";
import {
  nombreCookie,
  opcionesCookie,
} from "../config/env.js";
import type { Manejador } from "../types/http.types.js";
export const acceder: Manejador = async (_solicitud, respuesta) => {
  const datos = respuesta.locals.entrada.body as z.output<typeof accesoSchema>;
  const sesion = await servicio.iniciarSesion(datos);
  respuesta.set("Cache-Control", "no-store");
  respuesta.cookie(nombreCookie, sesion.token, {
    ...opcionesCookie,
    maxAge: servicio.duracionSesion * 1000,
  });
  respuesta.json({
    usuario: sesion.usuario,
    csrfToken: sesion.csrfToken,
    expiraEn: sesion.expiraEn,
  });
};
export const contextoSesion: Manejador = (_solicitud, respuesta) => {
  const usuario = respuesta.locals.usuario;
  respuesta.json({
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      emaId: usuario.emaId,
      esTecnico: usuario.esTecnico,
    },
    csrfToken: servicio.csrfSesion(respuesta.locals.sesionId),
  });
};
export const salir: Manejador = async (_solicitud, respuesta) => {
  await servicio.cerrarSesion(respuesta.locals.sesionId);
  respuesta.clearCookie(nombreCookie, opcionesCookie);
  respuesta.status(204).end();
};
