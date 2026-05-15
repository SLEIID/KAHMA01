import client from './client'

export interface VehicleUsageData {
  id: string
  kmDriven: number
  vehicle: { id: number; plateNumber: string; name: string }
}

export interface EntryMaterial {
  id: string
  materialId: number
  material: { id: number; name: string; catalogNumber: string | null }
  user: { id: string; fullName: string }
  quantity: string
  unit: string
  notes: string | null
  usedAt: string
}

export interface ReportEntry {
  id: string
  workStart: string
  workEnd: string
  location:   { id: number; name: string }
  department: { id: number; name: string } | null
  description: string
  createdAt: string
  updatedAt: string
  vehicleUsages: VehicleUsageData[]
  materialUsages?: EntryMaterial[]
}

export interface ReportSignature {
  id: string
  signedAt: string
  signer: { id: string; fullName: string }
}

export interface ReportRental {
  id:             string
  itemId:         number
  item:           { id: number; name: string; category: { id: number; name: string } }
  locationId:     number
  location:       { id: number; name: string }
  rentedAt:       string
  expectedReturn: string | null
  returnedAt:     string | null
  returnNotes:    string | null
}

export interface Report {
  id: string
  reportDate: string
  isLocked: boolean
  isSigned: boolean
  approvedAt: string | null
  approvedBy: { id: string; fullName: string } | null
  isOffer: 'offer' | 'no_offer' | 'to_quote' | null
  unlockedUntil: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; fullName: string; login: string }
  entries: ReportEntry[]
  signatures: ReportSignature[]
  equipmentRentals?: ReportRental[]
}

export interface AvailableReport {
  id: string
  user: { id: string; fullName: string }
  entries: ReportEntry[]
}

export interface ReportListResult {
  items: Report[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface EntryPayload {
  workStart:     string
  workEnd:       string
  locationId:    number
  departmentId?: number | null
  description:   string
  vehicleUsages?: { vehicleId: number; kmDriven: number }[]
}

export const reportsApi = {
  list: (params?: Record<string, string | number>) =>
    client.get<{ success: true; data: ReportListResult }>('/daily-reports', { params }),

  getById: (id: string) =>
    client.get<{ success: true; data: Report }>(`/daily-reports/${id}`),

  create: (opts?: { date?: string; userId?: string }) =>
    client.post<{ success: true; data: Report }>('/daily-reports', opts ?? {}),

  addEntry: (reportId: string, payload: EntryPayload) =>
    client.post<{ success: true; data: ReportEntry }>(`/daily-reports/${reportId}/entries`, payload),

  updateEntry: (entryId: string, payload: EntryPayload) =>
    client.patch<{ success: true; data: ReportEntry }>(`/daily-reports/entries/${entryId}`, payload),

  deleteEntry: (entryId: string) =>
    client.delete(`/daily-reports/entries/${entryId}`),

  approve: (id: string, isOffer: 'offer' | 'no_offer' | 'to_quote' | null) =>
    client.patch<{ success: true; data: Report }>(`/daily-reports/${id}/approve`, { isOffer }),

  exportXlsx: (params?: Record<string, string>) =>
    client.get('/daily-reports/export', { params, responseType: 'blob' }),

  availableToSign: () =>
    client.get<{ success: true; data: AvailableReport[] }>('/daily-reports/available-to-sign'),

  signOnto: (reportId: string, targetSignerId?: string) =>
    client.post<{ success: true; data: ReportSignature }>(`/daily-reports/${reportId}/sign`, targetSignerId ? { targetSignerId } : {}),

  signOff: (reportId: string, signerId?: string) =>
    client.delete(`/daily-reports/${reportId}/sign`, signerId ? { data: { signerId } } : undefined),

  unlock: (reportId: string) =>
    client.post<{ success: true; data: Report }>(`/daily-reports/${reportId}/unlock`),

  deleteReport: (id: string) =>
    client.delete(`/daily-reports/${id}`),
}
