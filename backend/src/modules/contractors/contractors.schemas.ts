import { z } from 'zod'

function validateNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const digits  = nip.split('').map(Number)
  const sum     = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
  const check   = sum % 11
  return check !== 10 && check === digits[9]
}

export const createContractorSchema = z.object({
  type:            z.enum(['client', 'supplier', 'both']).default('client'),
  name:            z.string().min(2, 'Podaj nazwę kontrahenta').max(300),
  nip:             z.string().regex(/^\d{10}$/, 'NIP musi mieć 10 cyfr').refine(validateNip, 'Nieprawidłowy NIP').optional().nullable(),
  street:          z.string().max(200).optional().nullable(),
  buildingNumber:  z.string().max(20).optional().nullable(),
  apartmentNumber: z.string().max(20).optional().nullable(),
  postalCode:      z.string().max(10).optional().nullable(),
  city:            z.string().max(100).optional().nullable(),
  country:         z.string().length(2).default('PL').optional(),
  email:           z.string().email('Nieprawidłowy adres e-mail').max(200).optional().nullable(),
  phone:           z.string().max(50).optional().nullable(),
  isVatPayer:      z.boolean().default(true).optional(),
})

export const updateContractorSchema = createContractorSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const listContractorsSchema = z.object({
  q:        z.string().optional(),
  type:     z.enum(['client', 'supplier', 'both']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

export type CreateContractorDto = z.infer<typeof createContractorSchema>
export type UpdateContractorDto = z.infer<typeof updateContractorSchema>
export type ListContractorsQuery = z.infer<typeof listContractorsSchema>
