export interface User {
  id: string
  login: string
  fullName: string
  role: { id: number; name: string }
  isActive: boolean
  canRentEquipment: boolean
  canOrder: boolean
  canPrepare: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface AuthUser {
  id: string
  login: string
  fullName: string
  role: string
  canRentEquipment: boolean
  canOrder: boolean
  canPrepare: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

export interface Department {
  id: number
  name: string
  locationId: number
  location: { id: number; name: string }
  isActive: boolean
  createdAt: string
}

export interface LeaveType {
  id:   number
  name: string
  paid: boolean
}

export interface LeaveBalance {
  userId?:       string
  fullName?:     string
  year:          number
  totalDays:     number
  usedDaysCarry: number
  approvedDays:  number
  remainingDays: number
}

export interface LeaveRequest {
  id:            string
  userId:        string
  user:          { id: string; fullName: string }
  leaveType:     LeaveType
  dateFrom:      string
  dateTo:        string
  daysCount:     number
  notes:         string | null
  status:        'pending' | 'approved' | 'rejected'
  reviewer:      { id: string; fullName: string } | null
  reviewedAt:    string | null
  reviewComment: string | null
  createdAt:     string
}

export interface AttendanceDay {
  hours:     number | null
  leaveType: string | null
}

export interface AttendanceData {
  year:        number
  month:       number
  daysInMonth: number
  users: {
    id:         string
    fullName:   string
    days:       Record<string, AttendanceDay>
    totalHours: number
  }[]
}

export interface CalendarEvent {
  id:        string
  user:      { id: string; fullName: string }
  leaveType: { name: string }
  dateFrom:  string
  dateTo:    string
  daysCount: number
}
