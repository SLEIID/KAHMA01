import { Request, Response, NextFunction } from 'express'
import * as svc from './vehicles.service'
import { createVehicleSchema, updateVehicleSchema } from './vehicles.schemas'
import { ok, created } from '../../shared/response'

export async function getAllHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Pracownicy widzą tylko aktywne; admini widzą wszystkie
    const onlyActive = req.user?.role !== 'admin'
    ok(res, await svc.getAll(onlyActive))
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createVehicleSchema.parse(req.body)
    created(res, await svc.create(dto))
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateVehicleSchema.parse(req.body)
    ok(res, await svc.update(Number(req.params.id), dto))
  } catch (err) { next(err) }
}

export async function deleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.remove(Number(req.params.id)))
  } catch (err) { next(err) }
}
