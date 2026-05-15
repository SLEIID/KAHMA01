import { z } from 'zod'

export const createDepartmentSchema = z.object({
  locationId: z.number().int().positive('Wybierz lokalizację'),
  name:       z.string().min(2).max(100),
})

export const updateDepartmentSchema = z.object({
  name:     z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
})

export const listDepartmentsSchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
})

export type CreateDepartmentDto  = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentDto  = z.infer<typeof updateDepartmentSchema>
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsSchema>
