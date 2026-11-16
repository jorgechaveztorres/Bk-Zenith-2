/** Error con código HTTP y mensaje simple para el usuario final. */
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
