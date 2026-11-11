export class ErrorHttp extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
  }
}
