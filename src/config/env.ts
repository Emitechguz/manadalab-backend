import "dotenv/config";
import { z } from "zod";
z.config(z.locales.es());

const configuracion = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  DATABASE_HOST: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("127.0.0.1"),
  APP_ORIGIN: z.url().default("http://127.0.0.1:4000"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  JWT_SECRET: z.string().min(64),
  MATRICULA_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  IDEMPOTENCY_SECRET: z.string().min(64),
  MATRICULA_PATTERN: z.string().max(200).default("^[A-Za-z0-9-]{1,32}$"),
});
const resultado = configuracion.safeParse(process.env);
if (!resultado.success) {
  throw new Error(
    "Configuración inválida: " +
      resultado.error.issues.map((i) => i.path.join(".")).join(", "),
  );
}
const valores = resultado.data;
const direccionBase = new URL(valores.DATABASE_URL);
if (valores.DATABASE_HOST) direccionBase.hostname = valores.DATABASE_HOST;
const origen = new URL(valores.APP_ORIGIN).origin;
if (valores.NODE_ENV === "production" && !origen.startsWith("https://")) {
  throw new Error("APP_ORIGIN debe usar HTTPS en producción.");
}
export const env = {
  databaseUrl: direccionBase.toString(),
  puerto: valores.PORT,
  direccion: valores.HOST,
  origen,
  trustProxy: valores.TRUST_PROXY,
  produccion: valores.NODE_ENV === "production",
  jwtSecret: valores.JWT_SECRET,
  matriculaKey: Buffer.from(valores.MATRICULA_KEY, "hex"),
  idempotencySecret: valores.IDEMPOTENCY_SECRET,
  matriculaPattern: new RegExp(valores.MATRICULA_PATTERN),
};

export const nombreCookie = env.produccion ? "__Host-manadalab_sesion" : "manadalab_sesion";
export const opcionesCookie = {
  httpOnly: true,
  secure: env.produccion,
  sameSite: "strict" as const,
  path: "/",
};
