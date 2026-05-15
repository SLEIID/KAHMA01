import client from './client'
import type { User } from '../types'

export interface CreateUserPayload {
  login: string
  password: string
  fullName: string
  role: 'admin' | 'pracownik'
  canRentEquipment?: boolean
  canOrder?: boolean
  canPrepare?: boolean
}

export interface UpdateUserPayload {
  login?: string
  fullName?: string
  role?: 'admin' | 'pracownik'
  isActive?: boolean
  password?: string
  canRentEquipment?: boolean
  canOrder?: boolean
  canPrepare?: boolean
}

export const usersApi = {
  getAll: () =>
    client.get<{ success: true; data: User[] }>('/users'),

  getById: (id: string) =>
    client.get<{ success: true; data: User }>(`/users/${id}`),

  create: (payload: CreateUserPayload) =>
    client.post<{ success: true; data: User }>('/users', payload),

  update: (id: string, payload: UpdateUserPayload) =>
    client.patch<{ success: true; data: User }>(`/users/${id}`, payload),
}
