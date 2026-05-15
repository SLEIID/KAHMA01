import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { ApiError } from '../shared/ApiError'

interface AccessTokenPayload {
  sub: string
  login: string
  role: string
  canRentEquipment: boolean
  canOrder: boolean
  canPrepare: boolean
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized())
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload
    req.user = { id: payload.sub, login: payload.login, role: payload.role, canRentEquipment: payload.canRentEquipment, canOrder: payload.canOrder ?? false, canPrepare: payload.canPrepare ?? false }
    next()
  } catch {
    next(ApiError.unauthorized('Token wygasł lub jest nieprawidłowy'))
  }
}
