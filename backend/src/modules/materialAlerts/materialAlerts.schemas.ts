import { z } from 'zod'

export const createAlertSchema = z.object({
  materialId: z.coerce.number().int().positive(),
  notes:      z.string().max(500).optional(),
})

export const updateAlertSchema = z.object({
  status: z.enum(['open', 'resolved']),
})

export type CreateAlertDto = z.infer<typeof createAlertSchema>
export type UpdateAlertDto = z.infer<typeof updateAlertSchema>
