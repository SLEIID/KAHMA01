import { Request, Response, NextFunction } from 'express'
import * as svc from './locations.service'
import { createLocationSchema, updateLocationSchema } from './locations.schemas'
import { ok, created } from '../../shared/response'
import { ApiError } from '../../shared/ApiError'

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.list(req.user!.role === 'admin')
    ok(res, result)
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Tworzenie lokalizacji dostępne dla wszystkich zalogowanych użytkowników
    const dto = createLocationSchema.parse(req.body)
    const result = await svc.create(dto)
    created(res, result)
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw ApiError.forbidden()
    const dto = updateLocationSchema.parse(req.body)
    const result = await svc.update(Number(req.params.id), dto)
    ok(res, result)
  } catch (err) { next(err) }
}
