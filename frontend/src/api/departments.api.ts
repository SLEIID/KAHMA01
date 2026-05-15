import client from './client'

export interface Department {
  id: number
  name: string
  locationId: number
  location: { id: number; name: string }
  isActive: boolean
  createdAt: string
}

export const departmentsApi = {
  list:   (locationId?: number) =>
    client.get<{ success: true; data: Department[] }>('/departments', {
      params: locationId ? { locationId } : undefined,
    }),
  create: (p: { locationId: number; name: string }) =>
    client.post<{ success: true; data: Department }>('/departments', p),
  update: (id: number, p: { name?: string; isActive?: boolean }) =>
    client.patch<{ success: true; data: Department }>(`/departments/${id}`, p),
}
