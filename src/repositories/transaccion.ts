import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export function enTransaccion<T>(
  operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(operacion, { maxWait: 5000, timeout: 15000 });
}

export function esConflictoConcurrente(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2034"].includes(error.code)
  );
}

export async function bloquear(
  clave: string, cliente: Prisma.TransactionClient,
) {
  await cliente.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))::text`;
}
