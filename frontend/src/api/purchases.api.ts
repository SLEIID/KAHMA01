import client from './client'

export type OrderStatus = 'pending' | 'ordered' | 'prepared' | 'delivered' | 'cancelled'

export interface OrderItem {
  id:         string
  materialId: number | null
  material:   { id: number; name: string; catalogNumber: string | null } | null
  customName: string | null
  quantity:   string
  unit:       string
  notes:      string | null
}

export interface PurchaseOrder {
  id:           string
  userId:       string
  user:         { id: string; fullName: string }
  locationId:   number | null
  location:     { id: number; name: string } | null
  departmentId: number | null
  department:   { id: number; name: string } | null
  status:       OrderStatus
  neededBy:     string | null
  notes:        string | null
  reportId:     string | null
  report:       { id: string; reportDate: string } | null
  createdAt:    string
  updatedAt:    string
  items:        OrderItem[]
}

export interface OrderListResult {
  items:  PurchaseOrder[]
  total:  number
  page:   number
  limit:  number
}

export interface CreateOrderItemPayload {
  materialId?: number
  customName?: string
  quantity:    number
  unit:        string
  notes?:      string
}

export interface CreateOrderPayload {
  locationId?:   number
  departmentId?: number
  neededBy?:     string
  notes?:        string
  items:         CreateOrderItemPayload[]
}

type Resp<T> = { success: true; data: T }

export const purchasesApi = {
  list: (params?: {
    status?: OrderStatus
    locationId?: number
    userId?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  }) =>
    client.get<Resp<OrderListResult>>('/purchase-orders', { params }),

  getById: (id: string) =>
    client.get<Resp<PurchaseOrder>>(`/purchase-orders/${id}`),

  create: (payload: CreateOrderPayload) =>
    client.post<Resp<PurchaseOrder>>('/purchase-orders', payload),

  updateStatus: (id: string, status: 'ordered' | 'prepared' | 'delivered' | 'cancelled') =>
    client.patch<Resp<PurchaseOrder>>(`/purchase-orders/${id}/status`, { status }),

  assignReport: (id: string, reportId: string | null) =>
    client.patch<Resp<PurchaseOrder>>(`/purchase-orders/${id}/report`, { reportId }),

  cancel: (id: string) =>
    client.patch<Resp<PurchaseOrder>>(`/purchase-orders/${id}/cancel`, {}),

  addItem: (orderId: string, payload: CreateOrderItemPayload) =>
    client.post<Resp<OrderItem>>(`/purchase-orders/${orderId}/items`, payload),

  updateItem: (orderId: string, itemId: string, payload: { quantity?: number; unit?: string; notes?: string | null }) =>
    client.patch<Resp<OrderItem>>(`/purchase-orders/${orderId}/items/${itemId}`, payload),

  deleteItem: (orderId: string, itemId: string) =>
    client.delete<Resp<{ message: string }>>(`/purchase-orders/${orderId}/items/${itemId}`),

  promoteItem: (orderId: string, itemId: string, payload: { name: string; catalogNumber?: string }) =>
    client.post<Resp<{ material: { id: number; name: string }; item: OrderItem }>>(
      `/purchase-orders/${orderId}/items/${itemId}/promote`,
      payload,
    ),
}
