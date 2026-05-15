export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static badRequest(msg: string) { return new ApiError(400, msg) }
  static unauthorized(msg = 'Brak autoryzacji') { return new ApiError(401, msg) }
  static forbidden(msg = 'Brak dostępu') { return new ApiError(403, msg) }
  static notFound(msg = 'Nie znaleziono') { return new ApiError(404, msg) }
  static conflict(msg: string) { return new ApiError(409, msg) }
  static internal(msg = 'Błąd serwera') { return new ApiError(500, msg) }
}
