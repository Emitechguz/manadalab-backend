import { Router } from "express";
import { consultarAulas } from "../controllers/aulas.controller.js";
import { validarConsultaAulas } from "../middlewares/aulas.middleware.js";
import { validarEntrada } from "../middlewares/validacion.middleware.js";
import { parametrosId, paginacionSchema } from "../schemas/comunes.schema.js";
import { recursos } from "../controllers/inventario.controller.js";

const aulasRouter = Router();

aulasRouter.get("/", validarConsultaAulas, consultarAulas);
aulasRouter.get(
  "/:id/recursos",
  validarEntrada(parametrosId, "params"),
  validarEntrada(paginacionSchema, "query"),
  recursos,
);

export default aulasRouter;
