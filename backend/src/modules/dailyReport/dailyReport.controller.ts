import { Request, Response, NextFunction } from 'express'
import * as svc from './dailyReport.service'
import { createEntrySchema, updateEntrySchema, listQuerySchema, approveReportSchema } from './dailyReport.schemas'
import { ok, created } from '../../shared/response'
import { ApiError } from '../../shared/ApiError'

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse(req.query)
    ok(res, await svc.list(query, req.user!.id, req.user!.role))
  } catch (err) { next(err) }
}

export async function getByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.getById(req.params.id, req.user!.id, req.user!.role))
  } catch (err) { next(err) }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, userId: targetUserId } = req.body as { date?: string; userId?: string }
    if (targetUserId && req.user!.role !== 'admin') throw ApiError.forbidden()
    const effectiveUserId = (targetUserId && req.user!.role === 'admin') ? targetUserId : req.user!.id
    const report = await svc.create(effectiveUserId, req.user!.role, date)
    created(res, report)
  } catch (err) { next(err) }
}

export async function addEntryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createEntrySchema.parse(req.body)
    const entry = await svc.addEntry(req.params.reportId, dto, req.user!.id, req.user!.role)
    created(res, entry)
  } catch (err) { next(err) }
}

export async function updateEntryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateEntrySchema.parse(req.body)
    ok(res, await svc.updateEntry(req.params.entryId, dto, req.user!.id, req.user!.role))
  } catch (err) { next(err) }
}

export async function deleteEntryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteEntry(req.params.entryId, req.user!.id, req.user!.role)
    ok(res, null)
  } catch (err) { next(err) }
}

export async function approveHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw ApiError.forbidden()
    const { isOffer } = approveReportSchema.parse(req.body)
    ok(res, await svc.approveReport(req.params.id, req.user!.id, isOffer))
  } catch (err) { next(err) }
}

export async function signOntoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const targetSignerId = req.user!.role === 'admin' ? (req.body?.targetSignerId as string | undefined) : undefined
    const sig = await svc.signOnto(req.user!.id, req.user!.role, req.params.id, targetSignerId)
    created(res, sig)
  } catch (err) { next(err) }
}

export async function signOffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const targetSignerId = req.user!.role === 'admin' ? (req.body?.signerId as string | undefined) : undefined
    await svc.signOff(req.user!.id, req.user!.role, req.params.id, targetSignerId)
    ok(res, null)
  } catch (err) { next(err) }
}

export async function availableToSignHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await svc.availableToSign(req.user!.id))
  } catch (err) { next(err) }
}

export async function unlockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw ApiError.forbidden()
    ok(res, await svc.unlockReport(req.params.id))
  } catch (err) { next(err) }
}

export async function deleteReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw ApiError.forbidden()
    await svc.deleteReport(req.params.id)
    ok(res, null)
  } catch (err) { next(err) }
}

export async function exportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw ApiError.forbidden()
    const { from, to, userId, locationId, departmentId } = req.query as Record<string, string | undefined>
    const buffer = await svc.exportXlsx({ from, to, userId, locationId, departmentId })
    const filename = `raporty_${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (err) { next(err) }
}
