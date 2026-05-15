import client from './client'

export interface Material {
  id:            number
  catalogNumber: string | null
  name:          string
  photoUrl:      string | null
  createdAt:     string
}

export interface MaterialUsage {
  id:           string
  reportId:     string | null
  report:       { id: string; reportDate: string } | null
  entryId:      string | null
  materialId:   number
  material:     Pick<Material, 'id' | 'name' | 'photoUrl' | 'catalogNumber'>
  userId:       string
  user:         { id: string; fullName: string }
  locationId:   number | null
  location:     { id: number; name: string } | null
  departmentId: number | null
  department:   { id: number; name: string } | null
  quantity:     string   // Decimal comes as string from Prisma JSON
  unit:         string
  notes:        string | null
  usedAt:       string
}

export interface MaterialAlert {
  id:         string
  materialId: number
  material:   Pick<Material, 'id' | 'name' | 'photoUrl'>
  reportedBy: string
  reporter:   { id: string; fullName: string }
  photoUrl:   string | null
  notes:      string | null
  status:     'open' | 'resolved'
  createdAt:  string
}

export interface UsageListResult {
  items:  MaterialUsage[]
  total:  number
  page:   number
  limit:  number
}

export interface MaterialSummaryItem {
  materialId:    number
  catalogNumber: string
  materialName:  string
  unit:          string
  totalQuantity: number
  usageCount:    number
}

export interface EmployeeSummaryItem {
  userId:          string
  fullName:        string
  totalUsageCount: number
  materials:       MaterialSummaryItem[]
}

export interface MonthlySummaryResult {
  overall:    MaterialSummaryItem[]
  byEmployee: EmployeeSummaryItem[]
  year:       number
  month:      number
}

type Resp<T> = { success: true; data: T }

export const materialsApi = {
  search: (q?: string) =>
    client.get<Resp<Material[]>>('/materials', { params: q ? { q } : {} }),

  getAll: () =>
    client.get<Resp<Material[]>>('/materials/all'),

  create: (payload: { catalogNumber?: string | null; name: string }) =>
    client.post<Resp<Material>>('/materials', payload),

  update: (id: number, payload: { catalogNumber?: string | null; name?: string }) =>
    client.patch<Resp<Material>>(`/materials/${id}`, payload),

  bulkCreate: (names: string[]) =>
    client.post<Resp<{ inserted: number }>>('/materials/bulk', { names }),
}

export const materialUsagesApi = {
  list: (params?: { from?: string; to?: string; userId?: string; materialId?: number; reportId?: string; locationId?: number; departmentId?: number; page?: number; limit?: number }) =>
    client.get<Resp<UsageListResult>>('/material-usages', { params }),

  create: (payload: { entryId?: string | null; reportId?: string | null; materialId: number; quantity: number; unit: string; notes?: string; locationId?: number | null; departmentId?: number | null }) =>
    client.post<Resp<MaterialUsage>>('/material-usages', payload),

  update: (id: string, payload: { quantity: number; unit: string; notes?: string | null }) =>
    client.patch<Resp<MaterialUsage>>(`/material-usages/${id}`, payload),

  remove: (id: string) =>
    client.delete<Resp<{ message: string }>>(`/material-usages/${id}`),

  getMonthlySummary: (year: number, month: number) =>
    client.get<Resp<MonthlySummaryResult>>('/material-usages/monthly-summary', { params: { year, month } }),

  exportFiltered: async (params: { from?: string; to?: string; userId?: string; locationId?: number; departmentId?: number }) => {
    const res = await client.get('/material-usages/export', {
      params,
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'zuzycie_materialow.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },

  exportMonthly: async (year: number, month: number) => {
    const label = `${String(month).padStart(2, '0')}_${year}`
    const res = await client.get('/material-usages/monthly-export', {
      params: { year, month },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `materialy_${label}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const materialAlertsApi = {
  list: () =>
    client.get<Resp<MaterialAlert[]>>('/material-alerts'),

  create: (payload: { materialId: number; notes?: string; photo?: File }) => {
    const fd = new FormData()
    fd.append('materialId', String(payload.materialId))
    if (payload.notes) fd.append('notes', payload.notes)
    if (payload.photo) fd.append('photo', payload.photo)
    return client.post<Resp<MaterialAlert>>('/material-alerts', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  resolve: (id: string) =>
    client.patch<Resp<MaterialAlert>>(`/material-alerts/${id}`, { status: 'resolved' }),
}
