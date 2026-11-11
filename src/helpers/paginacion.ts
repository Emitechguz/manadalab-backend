export function paginaRespuesta<T>(
  datos: T[],
  total: number,
  consulta: { pagina: number; limite: number },
) {
  return {
    datos,
    paginacion: {
      pagina: consulta.pagina,
      limite: consulta.limite,
      total,
      totalPaginas: Math.ceil(total / consulta.limite),
    },
  };
}
