import { User } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        login: string
        role: string
        canRentEquipment: boolean
        canOrder: boolean
        canPrepare: boolean
      }
    }
  }
}
