import { Request, Response, NextFunction } from 'express'
import * as svc from './materialUsages.service'
import { createUsageSchema, listUsagesSchema, exportUsagesSchema, updateUsageSchema, monthlySummarySchema } from './materialUsages.schemas'
import { ok, created } from '../../shared/response'

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createUsageSchema.parse(req.body)
    created(res, await svc.create(req.user!.id, req.user!.role, dto))
  } catch (err) { next(err) }
}

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = listUsagesSchema.parse(req.query)
    ok(res, await svc.getList(req.user!.id, req.user!.role, dto))
  } catch (err) { next(err) }
}

export async function removeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.remove(req.params.id, req.user!.id, req.user!.role)
    ok(res, { message: 'Usunięto' })
  } catch (err) { next(err) }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateUsageSchema.parse(req.body)
    ok(res, await svc.update(req.params.id, req.user!.id, req.user!.role, dto))
  } catch (err) { next(err) }
}

export async function monthlySummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ success: false, error: 'Brak uprawnień' }); return }
    const { year, month } = monthlySummarySchema.parse(req.query)
    ok(res, await svc.getMonthlySummary(year, month))
  } catch (err) { next(err) }
}

export async function exportFilteredHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ success: false, error: 'Brak uprawnień' }); return }
    const dto    = exportUsagesSchema.parse(req.query)
    const buffer = await svc.exportFiltered(dto)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="zuzycie_materialow.xlsx"')
    res.send(buffer)
  } catch (err) { next(err) }
}

export async function exportMonthlyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') { res.status(403).json({ success: false, error: 'Brak uprawnień' }); return }
    const { year, month } = monthlySummarySchema.parse(req.query)
    const { buffer, label } = await svc.exportMonthlyXlsx(year, month)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="materialy_${label}.xlsx"`)
    res.send(buffer)
  } catch (err) { next(err) }
}
