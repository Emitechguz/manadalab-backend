import { z } from "zod";
export const accesoSchema = z.strictObject({
  correo: z
    .email()
    .max(254)
    .transform((valor) => valor.toLowerCase()),
  contrasena: z.string().min(1).max(128),
});
