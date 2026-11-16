import { Router } from "express";
import { validarEntrada } from "../middlewares/validacion.middleware.js";
import {
  exigirOrigen,
  exigirJson,
  exigirSesion,
  exigirCsrf,
  limiteAltas,
  limiteDispositivo,
} from "../middlewares/seguridad.middleware.js";
import {
  parametrosIncidencia,
  consultaIncidenciasSchema,
  crearIncidenciaSchema,
  cambioEstadoSchema,
} from "../schemas/incidencias.schema.js";
import * as controlador from "../controllers/incidencias.controller.js";

export const incidenciasRouter = Router();
incidenciasRouter.get(
  "/",
  validarEntrada(consultaIncidenciasSchema, "query"),
  controlador.listarPublicas,
);
incidenciasRouter.post(
  "/",
  exigirOrigen,
  exigirJson,
  limiteAltas,
  validarEntrada(crearIncidenciaSchema),
  limiteDispositivo,
  controlador.registrar,
);
incidenciasRouter.patch(
  "/:id/estado",
  exigirOrigen,
  exigirJson,
  exigirSesion,
  exigirCsrf,
  validarEntrada(parametrosIncidencia, "params"),
  validarEntrada(cambioEstadoSchema),
  controlador.cambiarEstado,
);
incidenciasRouter.get(
  "/:id",
  validarEntrada(parametrosIncidencia, "params"),
  controlador.detallePublico,
);
export const adminIncidenciasRouter = Router();
adminIncidenciasRouter.use(exigirSesion);
adminIncidenciasRouter.get(
  "/",
  validarEntrada(consultaIncidenciasSchema, "query"),
  controlador.listarPrivadas,
);
adminIncidenciasRouter.get(
  "/:id",
  validarEntrada(parametrosIncidencia, "params"),
  controlador.detallePrivado,
);
