import client from './client'
import type { AuthUser } from '../types'

export interface LoginPayload { login: string; password: string }
export interface AuthResult { accessToken: string; user: AuthUser }

export const authApi = {
  login: (payload: LoginPayload) =>
    client.post<{ success: true; data: AuthResult }>('/auth/login', payload),

  logout: () =>
    client.post('/auth/logout'),

  refresh: () =>
    client.post<{ success: true; data: AuthResult }>('/auth/refresh'),
}
