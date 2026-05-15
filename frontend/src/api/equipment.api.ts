import client from './client'

export interface EquipmentCategory {
  id:   number
  name: string
}

export interface ActiveRentalUser {
  id:       string
  fullName: string
}

export interface ActiveRental {
  user:     ActiveRentalUser
  location: { id: number; name: string }
}

export type ItemStatus = 'available' | 'rented' | 'service' | 'retired'

export interface EquipmentItem {
  id:           number
  categoryId:   number
  category:     EquipmentCategory
  name:         string
  serialNumber: string | null
  status:       ItemStatus
  notes:        string | null
  createdAt:    string
  rentals:      ActiveRental[]   // aktywne wypożyczenie (max 1 element)
}

export interface EquipmentRental {
  id:             string
  itemId:         number
  item:           EquipmentItem
  userId:         string
  user:           { id: string; fullName: string }
  locationId:     number
  location:       { id: number; name: string }
  reportId:       string | null
  report:         { id: string; reportDate: string } | null
  rentedAt:       string
  expectedReturn: string | null
  returnedAt:     string | null
  returnNotes:    string | null
}

export interface EquipmentIssue {
  id:          string
  itemId:      number
  item:        EquipmentItem
  reportedBy:  string
  reporter:    { id: string; fullName: string }
  description: string
  status:      'open' | 'resolved'
  createdAt:   string
}

type Resp<T> = { success: true; data: T }

export const equipmentApi = {
  getCategories: () =>
    client.get<Resp<EquipmentCategory[]>>('/equipment/categories'),

  getItems: () =>
    client.get<Resp<EquipmentItem[]>>('/equipment/items'),

  createCategory: (payload: { name: string }) =>
    client.post<Resp<EquipmentCategory>>('/equipment/categories', payload),

  createItem: (payload: { categoryId: number; name: string; serialNumber?: string; notes?: string }) =>
    client.post<Resp<EquipmentItem>>('/equipment/items', payload),

  updateItem: (id: number, payload: Partial<{ name: string; categoryId: number; serialNumber: string | null; status: string; notes: string | null }>) =>
    client.patch<Resp<EquipmentItem>>(`/equipment/items/${id}`, payload),

  deleteItem: (id: number) =>
    client.delete(`/equipment/items/${id}`),
}

export const rentalsApi = {
  getAll: (params?: { date?: string }) =>
    client.get<Resp<EquipmentRental[]>>('/equipment-rentals', { params }),

  rent: (payload: { itemId: number; locationId: number; durationHours?: number; expectedReturn?: string; userId?: string; rentedAt?: string }) =>
    client.post<Resp<EquipmentRental>>('/equipment-rentals', payload),

  return: (rentalId: string, payload?: { returnNotes?: string }) =>
    client.patch<Resp<EquipmentRental>>(`/equipment-rentals/${rentalId}/return`, payload ?? {}),

  assignReport: (rentalId: string, reportId: string | null) =>
    client.patch<Resp<EquipmentRental>>(`/equipment-rentals/${rentalId}/report`, { reportId }),
}

export const issuesApi = {
  getAll: () =>
    client.get<Resp<EquipmentIssue[]>>('/equipment-issues'),

  create: (payload: { itemId: number; description: string }) =>
    client.post<Resp<EquipmentIssue>>('/equipment-issues', payload),

  update: (issueId: string, payload: { status: 'open' | 'resolved' }) =>
    client.patch<Resp<EquipmentIssue>>(`/equipment-issues/${issueId}`, payload),
}
