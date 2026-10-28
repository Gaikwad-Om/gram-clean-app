export type Role = 'resident' | 'worker' | 'supervisor' | 'admin'
export type Status = 'new' | 'assigned' | 'in_progress' | 'resolution_submitted' | 'verified' | 'reopened'
export type IssuePhoto = { url: string; kind: 'report' | 'completion'; createdAt: string }

export type Issue = {
  id: string
  displayId?: string
  organizationId?: string
  reporterId?: string
  workerId?: string
  departmentId?: string
  idempotencyKey?: string
  latitude?: number
  longitude?: number
  photos?: IssuePhoto[]
  title: string
  description: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: Status
  area: string
  location: string
  reporter: string
  department: string
  worker: string
  createdAt: string
  points: number
  photoName?: string
  resolutionNote?: string
}

export type Activity = {
  id: string
  title: string
  location: string
  status: Status
  time: string
  priority: Issue['priority']
}
