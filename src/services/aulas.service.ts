import { obtenerAulas } from "../repositories/aulas.repository.js";
import type { ConsultaAulas } from "../types/aulas.types.js";

export async function listarAulas(consulta: ConsultaAulas) {
  const { datos, total, conteos } = await obtenerAulas(consulta);

  const conteosPorAula = new Map(
    conteos.map((conteo) => [conteo.aulaId, conteo]),
  );

  const aulas = datos.map((aula) => {
    const conteo = conteosPorAula.get(aula.id);

    return {
      ...aula,
      incidencias: {
        pendientes: conteo?.pendientes ?? 0,
        vistas: conteo?.vistas ?? 0,
        solucionadas: conteo?.solucionadas ?? 0,
      },
    };
  });

  return {
    datos: aulas,
    paginacion: {
      pagina: consulta.pagina,
      limite: consulta.limite,
      total,
      totalPaginas: Math.ceil(total / consulta.limite),
    },
  };
}
