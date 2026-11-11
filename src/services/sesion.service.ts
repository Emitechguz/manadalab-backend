import { randomUUID, createHmac } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { ErrorHttp } from "../helpers/error-http.js";
import { huella } from "../helpers/seguridad.js";
import * as repositorio from "../repositories/sesion.repository.js";
import type { accesoSchema } from "../schemas/sesion.schema.js";

const emisor = "manadalab";
const audiencia = "manadalab-api";
export const duracionSesion = 15 * 60;
const hashInexistente = argon2.hash(randomUUID(), {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});
export function csrfSesion(id: string) {
  return createHmac("sha256", env.jwtSecret)
    .update("csrf:" + id)
    .digest("hex");
}
export async function iniciarSesion(datos: z.output<typeof accesoSchema>) {
  const usuario = await repositorio.buscarUsuario(datos.correo);
  const hash = usuario?.contrasenaHash ?? (await hashInexistente);
  const correcta = await argon2
    .verify(hash, datos.contrasena)
    .catch(() => false);
  if (!usuario || !correcta || !usuario.activo)
    throw new ErrorHttp(401, "Correo o contraseña incorrectos.");
  const id = randomUUID();
  const csrfToken = csrfSesion(id);
  const expiraEn = new Date(Date.now() + duracionSesion * 1000);
  await repositorio.crearSesion({
    id,
    usuarioId: usuario.id,
    csrfHash: huella(csrfToken),
    expiraEn,
  });
  const token = jwt.sign({}, env.jwtSecret, {
    algorithm: "HS256",
    issuer: emisor,
    audience: audiencia,
    subject: String(usuario.id),
    jwtid: id,
    expiresIn: duracionSesion,
  });
  return {
    token,
    csrfToken,
    expiraEn,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      emaId: usuario.emaId,
      esTecnico: usuario.esTecnico,
    },
  };
}
export async function autenticar(token: unknown) {
  if (typeof token !== "string")
    throw new ErrorHttp(401, "Inicia sesión para continuar.");
  let identificador: string;
  let sujeto: string;
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: emisor,
      audience: audiencia,
    });
    if (
      typeof payload === "string" ||
      !z.uuid().safeParse(payload.jti).success ||
      !payload.sub
    )
      throw new Error();
    identificador = payload.jti!;
    sujeto = payload.sub;
  } catch {
    throw new ErrorHttp(401, "La sesión no es válida o ha vencido.");
  }
  const sesion = await repositorio.buscarSesion(identificador);
  if (
    !sesion ||
    sesion.revocadaEn ||
    sesion.expiraEn <= new Date() ||
    !sesion.usuario.activo ||
    String(sesion.usuarioId) !== sujeto
  ) {
    throw new ErrorHttp(401, "La sesión no es válida o ha vencido.");
  }
  return sesion;
}
export const cerrarSesion = repositorio.revocarSesion;
