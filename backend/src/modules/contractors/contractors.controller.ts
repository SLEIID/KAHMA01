import { Request, Response, NextFunction } from 'express'
import * as svc from './contractors.service'
import { createContractorSchema, updateContractorSchema, listContractorsSchema } from './contractors.schemas'
import { ok, created } from '../../shared/response'

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listContractorsSchema.parse(req.query)
    const result = await svc.list(query)
    ok(res, result)
  } catch (err) { next(err) }
}

export async function getByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.getById(req.params.id)
    ok(res, result)
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createContractorSchema.parse(req.body)
    const result = await svc.create(dto)
    created(res, result)
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateContractorSchema.parse(req.body)
    const result = await svc.update(req.params.id, dto)
    ok(res, result)
  } catch (err) { next(err) }
}
