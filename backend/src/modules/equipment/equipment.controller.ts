import { Request, Response, NextFunction } from 'express'
import * as svc from './equipment.service'
import { createCategorySchema, createItemSchema, updateItemSchema } from './equipment.schemas'
import { ok, created } from '../../shared/response'

export async function getCategoriesHandler(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await svc.getAllCategories()) } catch (err) { next(err) }
}

export async function getItemsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.user!.role
    ok(res, await svc.getAllItems(role))
  } catch (err) { next(err) }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createCategorySchema.parse(req.body)
    created(res, await svc.createCategory(dto))
  } catch (err) { next(err) }
}

export async function createItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createItemSchema.parse(req.body)
    created(res, await svc.createItem(dto))
  } catch (err) { next(err) }
}

export async function updateItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateItemSchema.parse(req.body)
    ok(res, await svc.updateItem(Number(req.params.id), dto))
  } catch (err) { next(err) }
}

export async function deleteItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.removeItem(Number(req.params.id)))
  } catch (err) { next(err) }
}
