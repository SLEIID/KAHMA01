import { z } from 'zod'

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(2).max(20).toUpperCase(),
  name:        z.string().min(2).max(100),
})

export const updateVehicleSchema = z.object({
  plateNumber: z.string().min(2).max(20).toUpperCase().optional(),
  name:        z.string().min(2).max(100).optional(),
  isActive:    z.boolean().optional(),
})

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>
export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>
