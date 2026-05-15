import { z } from 'zod'

export const createUsageSchema = z.object({
  entryId:      z.string().uuid().optional().nullable(),
  reportId:     z.string().uuid('Podaj raport').optional().nullable(),
  materialId:   z.coerce.number().int().positive(),
  quantity:     z.coerce.number().positive().max(99999),
  unit:         z.string().min(1).max(20).default('szt'),
  notes:        z.string().max(500).optional(),
  // Jeśli entryId podany, locationId/departmentId są pobierane z wpisu automatycznie
  locationId:   z.coerce.number().int().positive().optional().nullable(),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
})

export const listUsagesSchema = z.object({
  from:         z.string().optional(),
  to:           z.string().optional(),
  userId:       z.string().uuid().optional(),
  materialId:   z.coerce.number().int().positive().optional(),
  reportId:     z.string().uuid().optional(),
  locationId:   z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  page:         z.coerce.number().int().positive().default(1),
  limit:        z.coerce.number().int().positive().max(200).default(50),
})

export const exportUsagesSchema = z.object({
  from:         z.string().optional(),
  to:           z.string().optional(),
  userId:       z.string().uuid().optional(),
  locationId:   z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
})

export const updateUsageSchema = z.object({
  quantity: z.coerce.number().positive().max(99999),
  unit:     z.string().min(1).max(20),
  notes:    z.string().max(500).nullable().optional(),
})

export const monthlySummarySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export type CreateUsageDto    = z.infer<typeof createUsageSchema>
export type ListUsagesDto     = z.infer<typeof listUsagesSchema>
export type ExportUsagesDto   = z.infer<typeof exportUsagesSchema>
export type UpdateUsageDto    = z.infer<typeof updateUsageSchema>
export type MonthlySummaryDto = z.infer<typeof monthlySummarySchema>
