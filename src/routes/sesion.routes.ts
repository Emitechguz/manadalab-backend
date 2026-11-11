import { Router } from "express";
import { accesoSchema } from "../schemas/sesion.schema.js";
import { validarEntrada } from "../middlewares/validacion.middleware.js";
import {
  exigirOrigen,
  exigirJson,
  exigirSesion,
  exigirCsrf,
  limiteAccesoIp,
  limiteAccesoCuenta,
} from "../middlewares/seguridad.middleware.js";
import {
  acceder,
  contextoSesion,
  salir,
} from "../controllers/sesion.controller.js";
const router = Router();
router.post(
  "/",
  limiteAccesoIp,
  exigirOrigen,
  exigirJson,
  validarEntrada(accesoSchema),
  limiteAccesoCuenta,
  acceder,
);
router.get("/", exigirSesion, contextoSesion);
router.delete("/", exigirOrigen, exigirSesion, exigirCsrf, salir);
export default router;
