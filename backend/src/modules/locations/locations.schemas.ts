import { z } from 'zod'

export const createLocationSchema = z.object({
  name: z.string().min(2, 'Podaj nazwę lokalizacji').max(200),
})

export const updateLocationSchema = z.object({
  name:         z.string().min(2).max(200).optional(),
  isActive:     z.boolean().optional(),
  contractorId: z.string().uuid().nullable().optional(),
})

export type CreateLocationDto = z.infer<typeof createLocationSchema>
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>
