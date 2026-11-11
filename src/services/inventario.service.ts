import * as repositorio from "../repositories/inventario.repository.js";
import { ErrorHttp } from "../helpers/error-http.js";
import { paginaRespuesta } from "../helpers/paginacion.js";
export async function recursosAula(
  id: number,
  consulta: { pagina: number; limite: number },
) {
  const aula = await repositorio.buscarAula(id);
  if (!aula) throw new ErrorHttp(404, "El aula no existe.");
  const [datos, total] = await repositorio.listarRecursos(
    id,
    consulta.pagina,
    consulta.limite,
  );
  return {
    aula,
    ...paginaRespuesta(
      datos.map(({ incidencias, ...dispositivo }) => ({
        ...dispositivo,
        incidenciaActiva: incidencias[0] ?? null,
      })),
      total,
      consulta,
    ),
  };
}
export async function consultarEmas(consulta: {
  pagina: number;
  limite: number;
}) {
  const [datos, total] = await repositorio.listarEmas(
    consulta.pagina,
    consulta.limite,
  );
  return paginaRespuesta(datos, total, consulta);
}
export async function consultarPrestables(
  emaId: number,
  consulta: { pagina: number; limite: number },
) {
  const [datos, total] = await repositorio.listarPrestables(
    emaId,
    consulta.pagina,
    consulta.limite,
  );
  return paginaRespuesta(datos, total, consulta);
}
