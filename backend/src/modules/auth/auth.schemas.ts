import { z } from 'zod'

export const loginSchema = z.object({
  login: z.string().min(4, 'Login musi mieć min. 4 znaki'),
  password: z.string().min(4, 'Hasło musi mieć min. 4 znaki'),
})

export type LoginDto = z.infer<typeof loginSchema>
