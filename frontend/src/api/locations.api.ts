import client from './client'

export interface LocationContractor {
  id:   string
  name: string
  nip:  string | null
  city: string | null
  type: string
}

export interface Location {
  id:           number
  name:         string
  isActive:     boolean
  createdAt:    string
  contractor:   LocationContractor | null
}

export const locationsApi = {
  getAll: () =>
    client.get<{ success: true; data: Location[] }>('/locations'),

  create: (p: { name: string }) =>
    client.post<{ success: true; data: Location }>('/locations', p),

  update: (id: number, p: { name?: string; isActive?: boolean; contractorId?: string | null }) =>
    client.patch<{ success: true; data: Location }>(`/locations/${id}`, p),
}
