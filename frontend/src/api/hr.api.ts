import api from './client'
import type { ApiResponse, LeaveType, LeaveBalance, LeaveRequest, AttendanceData, CalendarEvent } from '@/types'

export const hrApi = {
  getLeaveTypes: () =>
    api.get<ApiResponse<LeaveType[]>>('/hr/leave-types').then(r => r.data.data),

  getMyBalance: () =>
    api.get<ApiResponse<LeaveBalance>>('/hr/balances/me').then(r => r.data.data),

  getAllBalances: () =>
    api.get<ApiResponse<LeaveBalance[]>>('/hr/balances').then(r => r.data.data),

  updateBalance: (userId: string, data: { totalDays: number; usedDaysCarry: number }) =>
    api.patch<ApiResponse<unknown>>(`/hr/balances/${userId}`, data).then(r => r.data.data),

  getRequests: (params?: { status?: string; userId?: string }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/hr/requests', { params }).then(r => r.data.data),

  createRequest: (data: { leaveTypeId: number; dateFrom: string; dateTo: string; notes?: string }) =>
    api.post<ApiResponse<LeaveRequest>>('/hr/requests', data).then(r => r.data.data),

  reviewRequest: (id: string, data: { status: 'approved' | 'rejected'; reviewComment?: string }) =>
    api.patch<ApiResponse<LeaveRequest>>(`/hr/requests/${id}/review`, data).then(r => r.data.data),

  cancelRequest: (id: string) =>
    api.delete<ApiResponse<unknown>>(`/hr/requests/${id}`).then(r => r.data.data),

  getAttendance: (year: number, month: number) =>
    api.get<ApiResponse<AttendanceData>>('/hr/attendance', { params: { year, month } }).then(r => r.data.data),

  getCalendar: (year: number, month: number) =>
    api.get<ApiResponse<CalendarEvent[]>>('/hr/calendar', { params: { year, month } }).then(r => r.data.data),

  exportAttendance: (year: number, month: number) =>
    api.get('/hr/attendance/export', { params: { year, month }, responseType: 'blob' }),
}
