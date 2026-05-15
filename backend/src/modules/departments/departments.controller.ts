import { Request, Response, NextFunction } from 'express'
import * as svc from './departments.service'
import { createDepartmentSchema, updateDepartmentSchema, listDepartmentsSchema } from './departments.schemas'
import { ok, created } from '../../shared/response'

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listDepartmentsSchema.parse(req.query)
    ok(res, await svc.list(query))
  } catch (e) { next(e) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createDepartmentSchema.parse(req.body)
    created(res, await svc.create(dto))
  } catch (e) { next(e) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id  = Number(req.params.id)
    const dto = updateDepartmentSchema.parse(req.body)
    ok(res, await svc.update(id, dto))
  } catch (e) { next(e) }
}
