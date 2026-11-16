import { z } from "zod";

export const enteroConsulta = z
  .string({ error: "Debe ser un único valor de texto." })
  .max(10, { error: "Número demasiado largo.", abort: true })
  .regex(/^[1-9]\d*$/, { error: "Debe ser un entero positivo.", abort: true })
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(1)
      .max(2147483647, { error: "Número fuera de rango.", abort: true }),
  );
export const idNumerico = z.number().int().positive().max(2147483647);
export const parametrosId = z.strictObject({ id: enteroConsulta });
export const paginacion = {
  pagina: enteroConsulta.default(1),
  limite: enteroConsulta
    .pipe(
      z
        .number()
        .max(100, { error: "El límite no puede superar 100.", abort: true }),
    )
    .default(20),
};

export function desplazamientoValido(consulta: { pagina: number; limite: number; }) {
  return (consulta.pagina - 1) * consulta.limite <= 2147483647;
}
export const paginacionSchema = z
  .strictObject(paginacion)
  .refine(desplazamientoValido, {
    error: "La página excede el rango permitido.",
    path: ["pagina"],
  });
