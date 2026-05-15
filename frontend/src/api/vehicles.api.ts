import client from './client'

export interface Vehicle {
  id: number
  plateNumber: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface CreateVehiclePayload { plateNumber: string; name: string }
export interface UpdateVehiclePayload { plateNumber?: string; name?: string; isActive?: boolean }

export const vehiclesApi = {
  getAll:  () => client.get<{ success: true; data: Vehicle[] }>('/vehicles'),
  create:  (p: CreateVehiclePayload) => client.post<{ success: true; data: Vehicle }>('/vehicles', p),
  update:  (id: number, p: UpdateVehiclePayload) => client.patch<{ success: true; data: Vehicle }>(`/vehicles/${id}`, p),
  remove:  (id: number) => client.delete(`/vehicles/${id}`),
}
