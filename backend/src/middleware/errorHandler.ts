import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { ApiError } from '../shared/ApiError'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(', ')
    return res.status(400).json({ success: false, error: message })
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, error: err.message })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2003') {
      return res.status(400).json({ success: false, error: 'Nieprawidłowe powiązanie — rekord nie istnieje' })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Rekord nie istnieje' })
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Wartość już istnieje (duplikat)' })
    }
  }

  console.error('[UNHANDLED ERROR]', err)
  return res.status(500).json({ success: false, error: 'Wewnętrzny błąd serwera' })
}
