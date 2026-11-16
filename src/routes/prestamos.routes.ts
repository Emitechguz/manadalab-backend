import { Router } from "express";
import {
  exigirSesion,
  exigirOrigen,
  exigirJson,
  exigirCsrf,
} from "../middlewares/seguridad.middleware.js";
import { validarEntrada } from "../middlewares/validacion.middleware.js";
import { parametrosId, paginacionSchema } from "../schemas/comunes.schema.js";
import {
  consultaPrestamosSchema,
  nuevoPrestamoSchema,
  devolucionSchema,
} from "../schemas/prestamos.schema.js";
import * as controlador from "../controllers/prestamos.controller.js";

const router = Router();
router.use(exigirSesion);
router.get(
  "/dispositivos",
  validarEntrada(paginacionSchema, "query"),
  controlador.disponibles,
);
router.get(
  "/", validarEntrada(consultaPrestamosSchema, "query"), controlador.listar,
);
router.post(
  "/",
  exigirOrigen,
  exigirJson,
  exigirCsrf,
  validarEntrada(nuevoPrestamoSchema),
  controlador.crear,
);
router.get("/:id", validarEntrada(parametrosId, "params"), controlador.detalle);
router.patch(
  "/:id/devolucion",
  exigirOrigen,
  exigirJson,
  exigirCsrf,
  validarEntrada(parametrosId, "params"),
  validarEntrada(devolucionSchema),
  controlador.devolver,
);
export default router;
