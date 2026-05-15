import { z } from 'zod'

const UNITS = ['szt', 'mb', 'kg', 'kpl', 'rolka', 'opak', 'l', 'm2', 'm3'] as const

export const createOrderSchema = z.object({
  locationId:   z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  neededBy:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:        z.string().max(1000).optional(),
  items: z.array(z.object({
    materialId: z.number().int().positive().optional(),
    customName: z.string().min(1).max(300).optional(),
    quantity:   z.number().positive(),
    unit:       z.string().max(20).default('szt'),
    notes:      z.string().max(500).optional(),
  })).min(1, 'Zamówienie musi mieć co najmniej jedną pozycję'),
})

export const listOrdersSchema = z.object({
  status:     z.enum(['pending', 'ordered', 'prepared', 'delivered', 'cancelled']).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  userId:     z.string().uuid().optional(),
  from:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
})

export const updateStatusSchema = z.object({
  status: z.enum(['ordered', 'prepared', 'delivered', 'cancelled']),
})

export const assignReportSchema = z.object({
  reportId: z.string().uuid().nullable(),
})

export const addItemSchema = z.object({
  materialId: z.number().int().positive().optional(),
  customName: z.string().min(1).max(300).optional(),
  quantity:   z.number().positive(),
  unit:       z.string().max(20).default('szt'),
  notes:      z.string().max(500).optional(),
})

export const updateItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit:     z.string().max(20).optional(),
  notes:    z.string().max(500).nullable().optional(),
})

export const promoteItemSchema = z.object({
  name:          z.string().min(1).max(300),
  catalogNumber: z.string().max(100).optional(),
})

export type CreateOrderDto  = z.infer<typeof createOrderSchema>
export type ListOrdersDto   = z.infer<typeof listOrdersSchema>
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>
export type AssignReportDto = z.infer<typeof assignReportSchema>
export type AddItemDto      = z.infer<typeof addItemSchema>
export type UpdateItemDto   = z.infer<typeof updateItemSchema>
export type PromoteItemDto  = z.infer<typeof promoteItemSchema>
