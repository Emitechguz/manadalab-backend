import { z } from "zod";

const enteroPositivo = z
  .string()
  .max(10, {
    error: "Debe tener como máximo 10 dígitos.",
    abort: true,
  })
  .regex(/^[1-9]\d*$/, {
    error: "Debe ser un entero positivo.",
    abort: true,
  })
  .transform(Number)
  .pipe(
    z.number().int().min(1).max(2_147_483_647, {
      error: "El número excede el rango permitido.",
      abort: true,
    }),
  );

export const consultaAulasSchema = z
  .strictObject({
    emaId: enteroPositivo.optional(),
    pagina: enteroPositivo.default(1),
    limite: enteroPositivo
      .pipe(
        z.number().max(100, {
          error: "El límite no puede superar 100.",
          abort: true,
        }),
      )
      .default(20),
  })
  .refine(({ pagina, limite }) => (pagina - 1) * limite <= 2_147_483_647, {
    message: "La página solicitada excede el rango permitido.",
    path: ["pagina"],
  });
