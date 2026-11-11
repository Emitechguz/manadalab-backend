import { z } from "zod";
import { env } from "../config/env.js";
import {
  enteroConsulta,
  idNumerico,
  paginacion,
  desplazamientoValido,
} from "./comunes.schema.js";
export const parametrosIncidencia = z.strictObject({
  id: z.union([z.uuid(), enteroConsulta]),
});
export const consultaIncidenciasSchema = z
  .strictObject({
    ...paginacion,
    emaId: enteroConsulta.optional(),
    aulaId: enteroConsulta.optional(),
    tipoId: enteroConsulta.optional(),
    estado: z.enum(["PENDIENTE", "VISTO", "SOLUCIONADO"]).optional(),
  })
  .refine(desplazamientoValido, {
    error: "La página excede el rango permitido.",
    path: ["pagina"],
  });
export const crearIncidenciaSchema = z.strictObject({
  dispositivoId: idNumerico,
  matricula: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .refine(
      (valor) => env.matriculaPattern.test(valor),
      "El formato de matrícula no es válido.",
    ),
  descripcion: z
    .string()
    .trim()
    .min(5, "Describe el problema con al menos 5 caracteres.")
    .max(2000),
});
export const cambioEstadoSchema = z.strictObject({
  estado: z.enum(["VISTO", "SOLUCIONADO"]),
  version: idNumerico,
});
export const claveReintentoSchema = z.uuid();
