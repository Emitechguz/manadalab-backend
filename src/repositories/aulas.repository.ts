import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import type { ConsultaAulas, ConteoIncidenciasAula, } from "../types/aulas.types.js";

export function obtenerAulas({ emaId, pagina, limite }: ConsultaAulas) {
  const where = emaId === undefined ? {} : { emaId };

  return prisma.$transaction(
    async (transaccion) => {
      const datos = await transaccion.aula.findMany({
        where,
        select: {
          id: true,
          numero: true,
          emaId: true,
          ema: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: [{ emaId: "asc" }, { numero: "asc" }, { id: "asc" }],
        skip: (pagina - 1) * limite,
        take: limite,
      });

      const total = await transaccion.aula.count({ where });

      const idsAulas = datos.map((aula) => aula.id);

      const conteos =
        idsAulas.length === 0
          ? []
          : await transaccion.$queryRaw<ConteoIncidenciasAula[]>`
              SELECT
                d.aula_id AS "aulaId",
                (
                  COUNT(*) FILTER (WHERE i.estado = 'pendiente')
                )::integer AS pendientes,
                (
                  COUNT(*) FILTER (WHERE i.estado = 'visto')
                )::integer AS vistas,
                (
                  COUNT(*) FILTER (WHERE i.estado = 'solucionado')
                )::integer AS solucionadas
              FROM incidencias AS i
              JOIN dispositivos AS d
                ON d.id = i.dispositivo_id
              WHERE d.aula_id IN (${Prisma.join(idsAulas)})
              GROUP BY d.aula_id
            `;

      return { datos, total, conteos };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
