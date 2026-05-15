import { z } from 'zod'

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.number().int().positive(),
  dateFrom:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format daty: YYYY-MM-DD'),
  dateTo:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format daty: YYYY-MM-DD'),
  notes:       z.string().max(500).optional(),
})

export const reviewLeaveRequestSchema = z.object({
  status:        z.enum(['approved', 'rejected']),
  reviewComment: z.string().max(500).optional(),
})

export const updateBalanceSchema = z.object({
  totalDays:     z.number().int().min(0).max(365),
  usedDaysCarry: z.number().int().min(0).max(365),
})

export const attendanceQuerySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export const requestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  userId: z.string().uuid().optional(),
})

export type CreateLeaveRequestDto = z.infer<typeof createLeaveRequestSchema>
export type ReviewLeaveRequestDto = z.infer<typeof reviewLeaveRequestSchema>
export type UpdateBalanceDto      = z.infer<typeof updateBalanceSchema>
