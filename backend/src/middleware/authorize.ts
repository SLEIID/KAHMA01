import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../shared/ApiError'

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden())
    next()
  }
}
