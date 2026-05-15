import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'
import { loginSchema } from './auth.schemas'
import { ok } from '../../shared/response'
import { ApiError } from '../../shared/ApiError'

const REFRESH_COOKIE = 'kahma_refresh'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = loginSchema.parse(req.body)
    const result = await authService.login(dto)

    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS)
    ok(res, { accessToken: result.accessToken, user: result.user })
  } catch (err) {
    next(err)
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) throw ApiError.unauthorized()

    const result = await authService.refresh(token)
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS)
    ok(res, { accessToken: result.accessToken, user: result.user })
  } catch (err) {
    next(err)
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (token) await authService.logout(token)

    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' })
    ok(res, { message: 'Wylogowano pomyślnie' })
  } catch (err) {
    next(err)
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, req.user)
  } catch (err) {
    next(err)
  }
}
