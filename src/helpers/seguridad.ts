import { createCipheriv, createHmac, randomBytes, timingSafeEqual, } from "node:crypto";
import { env } from "../config/env.js";

export function huella(texto: string) {
  return createHmac("sha256", env.idempotencySecret)
    .update(texto)
    .digest("hex");
}

export function tokenAleatorio() {
  return randomBytes(32).toString("hex");
}

export function iguales(a: string, b: string) {
  const izquierda = Buffer.from(a);
  const derecha = Buffer.from(b);
  return (izquierda.length === derecha.length && timingSafeEqual(izquierda, derecha)
  );
}

export function cifrarMatricula(matricula: string) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", env.matriculaKey, iv);
  const datos = Buffer.concat([
    cifrador.update(matricula, "utf8"), cifrador.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cifrador.getAuthTag().toString("base64"),
    datos.toString("base64"),
  ].join(":");
}
