import { Request, Response, NextFunction } from 'express'
import * as hrService from './hr.service'
import { ok, created } from '../../shared/response'
import {
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  updateBalanceSchema,
  attendanceQuerySchema,
  requestsQuerySchema,
} from './hr.schemas'

export async function getLeaveTypes(_req: Request, res: Response, next: NextFunction) {
  try { ok(res, await hrService.getLeaveTypes()) } catch (e) { next(e) }
}

export async function getMyBalance(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await hrService.getMyBalance(req.user!.id)) } catch (e) { next(e) }
}

export async function getAllBalances(_req: Request, res: Response, next: NextFunction) {
  try { ok(res, await hrService.getAllBalances()) } catch (e) { next(e) }
}

export async function updateBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = updateBalanceSchema.parse(req.body)
    ok(res, await hrService.updateBalance(req.params.userId, dto))
  } catch (e) { next(e) }
}

export async function getRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const q = requestsQuerySchema.parse(req.query)
    ok(res, await hrService.getRequests(req.user!.id, req.user!.role, q.status, q.userId))
  } catch (e) { next(e) }
}

export async function createRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createLeaveRequestSchema.parse(req.body)
    created(res, await hrService.createRequest(req.user!.id, dto))
  } catch (e) { next(e) }
}

export async function reviewRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = reviewLeaveRequestSchema.parse(req.body)
    ok(res, await hrService.reviewRequest(req.params.id, req.user!.id, dto))
  } catch (e) { next(e) }
}

export async function cancelRequest(req: Request, res: Response, next: NextFunction) {
  try {
    await hrService.cancelRequest(req.params.id, req.user!.id)
    ok(res, { cancelled: true })
  } catch (e) { next(e) }
}

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { year, month } = attendanceQuerySchema.parse(req.query)
    ok(res, await hrService.getAttendance(year, month))
  } catch (e) { next(e) }
}

export async function getCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    const { year, month } = attendanceQuerySchema.parse(req.query)
    ok(res, await hrService.getCalendar(year, month))
  } catch (e) { next(e) }
}

export async function exportAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { year, month } = attendanceQuerySchema.parse(req.query)
    const buf = await hrService.exportAttendanceXlsx(year, month)
    const monthPad = String(month).padStart(2, '0')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="obecnosc_${year}_${monthPad}.xlsx"`)
    res.send(buf)
  } catch (e) { next(e) }
}
