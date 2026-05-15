import client from './client'

export interface Contractor {
  id:              string
  type:            'client' | 'supplier' | 'both'
  name:            string
  nip:             string | null
  street:          string | null
  buildingNumber:  string | null
  apartmentNumber: string | null
  postalCode:      string | null
  city:            string | null
  country:         string
  email:           string | null
  phone:           string | null
  isVatPayer:      boolean
  isActive:        boolean
  createdAt:       string
  updatedAt:       string
}

export interface ContractorDetail extends Contractor {
  locations: { id: number; name: string; isActive: boolean }[]
}

export type CreateContractorPayload = {
  type?:            'client' | 'supplier' | 'both'
  name:             string
  nip?:             string | null
  street?:          string | null
  buildingNumber?:  string | null
  apartmentNumber?: string | null
  postalCode?:      string | null
  city?:            string | null
  country?:         string
  email?:           string | null
  phone?:           string | null
  isVatPayer?:      boolean
}

export type UpdateContractorPayload = Partial<CreateContractorPayload & { isActive: boolean }>

export const contractorsApi = {
  list: (params?: { q?: string; type?: string; isActive?: string }) =>
    client.get<{ success: true; data: Contractor[] }>('/contractors', { params }),

  getById: (id: string) =>
    client.get<{ success: true; data: ContractorDetail }>(`/contractors/${id}`),

  create: (payload: CreateContractorPayload) =>
    client.post<{ success: true; data: Contractor }>('/contractors', payload),

  update: (id: string, payload: UpdateContractorPayload) =>
    client.patch<{ success: true; data: Contractor }>(`/contractors/${id}`, payload),
}
