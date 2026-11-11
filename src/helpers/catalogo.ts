export const tiposDispositivo = [
  { nombre: "Computadora", esPrestable: false },
  { nombre: "TV", esPrestable: false },
  { nombre: "Aire acondicionado", esPrestable: false },
  { nombre: "Enchufe", esPrestable: false },
  { nombre: "Iluminación", esPrestable: false },
  { nombre: "Antena Wi-Fi", esPrestable: true },
  { nombre: "Control de TV", esPrestable: true },
  { nombre: "Control de aire acondicionado", esPrestable: true },
];
export function esComputadora(nombre: string) {
  return nombre === "Computadora";
}
export function esReportable(nombre: string) {
  return tiposDispositivo.some(
    (tipo) => tipo.nombre === nombre && !tipo.esPrestable,
  );
}
