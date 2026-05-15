import { Request, Response, NextFunction } from 'express'
import * as usersService from './users.service'
import { createUserSchema, updateUserSchema } from './users.schemas'
import { ok, created } from '../../shared/response'

export async function getAllHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await usersService.getAll()
    ok(res, users)
  } catch (err) { next(err) }
}

export async function getByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getById(req.params.id)
    ok(res, user)
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createUserSchema.parse(req.body)
    const user = await usersService.create(dto)
    created(res, user)
  } catch (err) { next(err) }
}

export async function getMyStatsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await usersService.getMyStats(req.user!.id)
    ok(res, stats)
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateUserSchema.parse(req.body)
    const user = await usersService.update(req.params.id, dto)
    ok(res, user)
  } catch (err) { next(err) }
}
