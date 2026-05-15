import { Request, Response, NextFunction } from 'express'
import * as svc from './equipmentIssues.service'
import { createIssueSchema, updateIssueSchema } from './equipmentIssues.schemas'
import { ok, created } from '../../shared/response'

export async function getAllHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.getAll(req.user!.id, req.user!.role))
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createIssueSchema.parse(req.body)
    created(res, await svc.createIssue(req.user!.id, dto))
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateIssueSchema.parse(req.body)
    ok(res, await svc.updateIssue(req.params.id, dto))
  } catch (err) { next(err) }
}
