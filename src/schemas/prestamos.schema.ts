import { z } from "zod";
import {
  idNumerico,
  enteroConsulta,
  paginacion,
  desplazamientoValido,
} from "./comunes.schema.js";

export const nuevoPrestamoSchema = z.strictObject({
  dispositivoId: idNumerico,
  profesorNombre: z.string().trim().min(2).max(150),
});
export const consultaPrestamosSchema = z
  .strictObject({
    ...paginacion,
    estado: z.enum(["PENDIENTE", "DEVUELTO"]).optional(),
    dispositivoId: enteroConsulta.optional(),
  })
  .refine(desplazamientoValido, {
    error: "La página excede el rango permitido.",
    path: ["pagina"],
  });
export const devolucionSchema = z.strictObject({});
