import { listarAulas } from "../services/aulas.service.js";
import type { ManejadorConsultaAulas } from "../types/aulas.types.js";

export const consultarAulas: ManejadorConsultaAulas = async (
  _solicitud, respuesta,
) => {
  const resultado = await listarAulas(respuesta.locals.consultaAulas);

  respuesta.status(200).json(resultado);
};
