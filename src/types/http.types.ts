import type { RequestHandler } from "express";
import type { Prisma } from "../generated/prisma/client.js";

export type UsuarioAutenticado = Prisma.UsuarioGetPayload<{
  select: {
    id: true;
    nombre: true;
    correo: true;
    emaId: true;
    esTecnico: true;
  };
}>;
export type ContextoHttp = {
  usuario: UsuarioAutenticado;
  sesionId: string;
  csrfHash: string;
  entrada: Record<string, unknown>;
};
export type Manejador = RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  unknown,
  ContextoHttp
>;
