import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

const vehicleUsageSchema = z.object({
  vehicleId: z.number().int().positive(),
  kmDriven:  z.number().int().min(0),
})

export const createEntrySchema = z.object({
  workStart:     z.string().regex(timeRegex, 'Format czasu: HH:MM'),
  workEnd:       z.string().regex(timeRegex, 'Format czasu: HH:MM'),
  locationId:    z.number().int().positive('Wybierz lokalizację'),
  departmentId:  z.number().int().positive().optional().nullable(),
  description:   z.string().min(3, 'Podaj opis pracy').max(2000),
  vehicleUsages: z.array(vehicleUsageSchema).optional(),
}).refine(
  (d) => d.workEnd > d.workStart,
  { message: 'Godzina zakończenia musi być późniejsza niż rozpoczęcia', path: ['workEnd'] }
)

export const updateEntrySchema = z.object({
  workStart:     z.string().regex(timeRegex).optional(),
  workEnd:       z.string().regex(timeRegex).optional(),
  locationId:    z.number().int().positive().optional(),
  departmentId:  z.number().int().positive().optional().nullable(),
  description:   z.string().min(3).max(2000).optional(),
  vehicleUsages: z.array(vehicleUsageSchema).optional(),
}).refine(
  (d) => {
    if (!d.workStart || !d.workEnd) return true
    return d.workEnd > d.workStart
  },
  { message: 'Godzina zakończenia musi być późniejsza niż rozpoczęcia', path: ['workEnd'] }
)

export const listQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  from:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId:       z.string().uuid().optional(),
  locationId:   z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
})

export const approveReportSchema = z.object({
  isOffer: z.enum(['offer', 'no_offer', 'to_quote']).nullable(),
})

export type CreateEntryDto   = z.infer<typeof createEntrySchema>
export type UpdateEntryDto   = z.infer<typeof updateEntrySchema>
export type ListQuery        = z.infer<typeof listQuerySchema>
export type ApproveReportDto = z.infer<typeof approveReportSchema>
