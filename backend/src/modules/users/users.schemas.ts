import { z } from 'zod'

export const createUserSchema = z.object({
  login: z.string().min(4, 'Login musi mieć min. 4 znaki').max(50),
  password: z.string().min(4, 'Hasło musi mieć min. 4 znaki').max(100),
  fullName: z.string().min(2, 'Imię i nazwisko musi mieć min. 2 znaki').max(100),
  role: z.enum(['admin', 'pracownik']),
  canRentEquipment: z.boolean().optional(),
  canOrder: z.boolean().optional(),
  canPrepare: z.boolean().optional(),
})

export const updateUserSchema = z.object({
  login: z.string().min(4).max(50).optional(),
  fullName: z.string().min(2).max(100).optional(),
  role: z.enum(['admin', 'pracownik']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(4).max(100).optional(),
  canRentEquipment: z.boolean().optional(),
  canOrder: z.boolean().optional(),
  canPrepare: z.boolean().optional(),
})

export type CreateUserDto = z.infer<typeof createUserSchema>
export type UpdateUserDto = z.infer<typeof updateUserSchema>
