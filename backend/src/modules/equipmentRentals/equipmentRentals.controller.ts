import { Request, Response, NextFunction } from 'express'
import * as svc from './equipmentRentals.service'
import { rentItemSchema, returnItemSchema, assignReportSchema, listRentalsQuerySchema } from './equipmentRentals.schemas'
import { ok, created } from '../../shared/response'

export async function getAllHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listRentalsQuerySchema.parse(req.query)
    ok(res, await svc.getAll(req.user!.id, req.user!.role, query))
  } catch (err) { next(err) }
}

export async function rentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = rentItemSchema.parse(req.body)
    created(res, await svc.rentItem(req.user!.id, req.user!.role, dto))
  } catch (err) { next(err) }
}

export async function returnHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = returnItemSchema.parse(req.body)
    ok(res, await svc.returnItem(req.params.id, req.user!.id, req.user!.role, dto))
  } catch (err) { next(err) }
}

export async function assignReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = assignReportSchema.parse(req.body)
    ok(res, await svc.assignReport(req.params.id, req.user!.id, req.user!.role, dto))
  } catch (err) { next(err) }
}
