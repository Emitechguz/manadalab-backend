import type { RequestHandler } from "express";
import type { z } from "zod";
import type { consultaAulasSchema } from "../schemas/aulas.schema.js";

export type ConsultaAulas = z.infer<typeof consultaAulasSchema>;

export type ManejadorConsultaAulas = RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  unknown,
  { consultaAulas: ConsultaAulas }
>;

export type ConteoIncidenciasAula = {
  aulaId: number;
  pendientes: number;
  vistas: number;
  solucionadas: number;
};
