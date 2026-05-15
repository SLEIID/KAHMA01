import { Request, Response, NextFunction } from 'express'
import * as svc from './materialAlerts.service'
import { createAlertSchema, updateAlertSchema } from './materialAlerts.schemas'
import { ok, created } from '../../shared/response'
import { uploadPhoto } from '../../middleware/upload'

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  uploadPhoto(req, res, async (uploadErr) => {
    if (uploadErr) return next(uploadErr)
    try {
      const dto      = createAlertSchema.parse(req.body)
      const filename = (req.file as Express.Multer.File | undefined)?.filename
      created(res, await svc.create(req.user!.id, dto, filename))
    } catch (err) { next(err) }
  })
}

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.getList(req.user!.role, req.user!.id))
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateAlertSchema.parse(req.body)
    ok(res, await svc.updateStatus(req.params.id, req.user!.role, dto))
  } catch (err) { next(err) }
}
