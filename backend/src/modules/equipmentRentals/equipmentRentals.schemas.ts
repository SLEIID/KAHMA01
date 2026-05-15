import { z } from 'zod'

export const rentItemSchema = z.object({
  itemId:         z.coerce.number().int().positive(),
  locationId:     z.coerce.number().int().positive(),
  durationHours:  z.coerce.number().int().positive().max(720).optional(),
  expectedReturn: z.string().datetime().optional(),
  userId:         z.string().uuid().optional(),   // admin only: wynajem za pracownika
  rentedAt:       z.string().optional(),          // admin only: wynajem wstecz (ISO date)
})

export const returnItemSchema = z.object({
  returnNotes: z.string().optional(),
})

export const assignReportSchema = z.object({
  reportId: z.string().uuid().nullable(),
})

export const listRentalsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type RentItemDto       = z.infer<typeof rentItemSchema>
export type ReturnItemDto     = z.infer<typeof returnItemSchema>
export type AssignReportDto   = z.infer<typeof assignReportSchema>
export type ListRentalsQuery  = z.infer<typeof listRentalsQuerySchema>
