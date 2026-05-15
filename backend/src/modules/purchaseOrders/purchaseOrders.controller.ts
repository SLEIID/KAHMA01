import { Request, Response, NextFunction } from 'express'
import * as svc from './purchaseOrders.service'
import {
  createOrderSchema, listOrdersSchema, updateStatusSchema,
  assignReportSchema, addItemSchema, updateItemSchema, promoteItemSchema,
} from './purchaseOrders.schemas'
import { ok, created } from '../../shared/response'

function requester(req: Request) {
  return { id: req.user!.id, role: req.user!.role, canOrder: req.user!.canOrder, canPrepare: req.user!.canPrepare }
}

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = listOrdersSchema.parse(req.query)
    ok(res, await svc.list(requester(req), dto))
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createOrderSchema.parse(req.body)
    created(res, await svc.create(requester(req), dto))
  } catch (err) { next(err) }
}

export async function getByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.getById(req.params.id, requester(req)))
  } catch (err) { next(err) }
}

export async function updateStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateStatusSchema.parse(req.body)
    ok(res, await svc.updateStatus(req.params.id, requester(req), dto))
  } catch (err) { next(err) }
}

export async function assignReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = assignReportSchema.parse(req.body)
    ok(res, await svc.assignReport(req.params.id, requester(req), dto))
  } catch (err) { next(err) }
}

export async function cancelHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.cancel(req.params.id, requester(req)))
  } catch (err) { next(err) }
}

export async function addItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = addItemSchema.parse(req.body)
    created(res, await svc.addItem(req.params.orderId, requester(req), dto))
  } catch (err) { next(err) }
}

export async function updateItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateItemSchema.parse(req.body)
    ok(res, await svc.updateItem(req.params.orderId, req.params.itemId, requester(req), dto))
  } catch (err) { next(err) }
}

export async function deleteItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteItem(req.params.orderId, req.params.itemId, requester(req))
    ok(res, { message: 'Usunięto' })
  } catch (err) { next(err) }
}

export async function promoteItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = promoteItemSchema.parse(req.body)
    ok(res, await svc.promoteItem(req.params.orderId, req.params.itemId, requester(req), dto))
  } catch (err) { next(err) }
}
