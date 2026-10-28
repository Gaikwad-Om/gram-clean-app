import type { Session } from '@supabase/supabase-js'
import type { Issue, Role, Status } from '../types'
import { supabase } from './supabase'

export type VillageWorkspace = { organizationId: string; organizationName: string; slug: string; role: Role }
export type VillageProfile = { id: string; displayName: string; preferredLanguage: string }
export type VillageOption = { id: string; name: string }
export type WorkspaceLookups = { workers: Array<Pick<VillageProfile, 'id' | 'displayName'>>; departments: VillageOption[]; wards: VillageOption[] }
export type LeaderboardMember = { id: string; name: string; points: number }
export type VillageMember = { userId: string; displayName: string; role: Role; active: boolean }
export type VillageNotification = { id: string; issueId: string | null; title: string; body: string; kind: string; readAt: string | null; createdAt: string }
export type SimilarVillageIssue = { id: string; category: string; status: Status; area: string; createdAt: string }

type DbIssue = {
  id: string; organization_id: string; ward_id: string | null; department_id: string | null; reporter_id: string;
  title: string; description: string; category: string; priority: Issue['priority']; status: Status;
  location_text: string; created_at: string; updated_at: string; latitude: number | null; longitude: number | null;
}

const failIfError = <T,>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('The village data could not be loaded.')
  return result.data
}

export async function getVillageWorkspaces(session: Session): Promise<VillageWorkspace[]> {
  if (!supabase) return []
  const memberships = failIfError(await supabase.from('memberships').select('organization_id, role').eq('user_id', session.user.id).eq('active', true)) as Array<{ organization_id: string; role: Role }>
  if (!memberships.length) return []
  const organizations = failIfError(await supabase.from('organizations').select('id, name, slug').in('id', memberships.map(item => item.organization_id))) as Array<{ id: string; name: string; slug: string }>
  return memberships.flatMap(membership => {
    const organization = organizations.find(item => item.id === membership.organization_id)
    return organization ? [{ organizationId: organization.id, organizationName: organization.name, slug: organization.slug, role: membership.role }] : []
  })
}

export async function getVillageProfile(userId: string): Promise<VillageProfile | null> {
  if (!supabase) return null
  const result = await supabase.from('profiles').select('id, display_name, preferred_language').eq('id', userId).maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return result.data ? { id: result.data.id as string, displayName: result.data.display_name as string, preferredLanguage: result.data.preferred_language as string } : null
}

export async function loadVillageIssues(organizationId: string): Promise<{ issues: Issue[]; lookups: WorkspaceLookups }> {
  if (!supabase) return { issues: [], lookups: { workers: [], departments: [], wards: [] } }
  const [issueResult, assignmentResult, profileResult, wardResult, departmentResult, membershipResult] = await Promise.all([
    supabase.from('issues').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(200),
    supabase.from('assignments').select('issue_id, worker_id, department_id, active').eq('organization_id', organizationId).eq('active', true),
    supabase.from('profiles').select('id, display_name'),
    supabase.from('wards').select('id, name').eq('organization_id', organizationId).eq('active', true),
    supabase.from('departments').select('id, name').eq('organization_id', organizationId).eq('active', true),
    supabase.from('memberships').select('user_id').eq('organization_id', organizationId).eq('role', 'worker').eq('active', true),
  ])
  const dbIssues = failIfError(issueResult) as DbIssue[]
  const assignments = failIfError(assignmentResult) as Array<{ issue_id: string; worker_id: string; department_id: string; active: boolean }>
  const profiles = failIfError(profileResult) as Array<{ id: string; display_name: string }>
  const wards = failIfError(wardResult) as Array<{ id: string; name: string }>
  const departments = failIfError(departmentResult) as Array<{ id: string; name: string }>
  const workerMemberships = failIfError(membershipResult) as Array<{ user_id: string }>
  const photoRows = dbIssues.length ? failIfError(await supabase.from('issue_photos').select('issue_id, storage_path, photo_kind, created_at').in('issue_id', dbIssues.map(issue => issue.id))) as Array<{ issue_id: string; storage_path: string; photo_kind: 'report' | 'completion'; created_at: string }> : []
  const photoUrls = new Map<string, { url: string; kind: 'report' | 'completion'; createdAt: string }[]>()
  if (photoRows.length) {
    const signed = await supabase.storage.from('issue-photos').createSignedUrls(photoRows.map(photo => photo.storage_path), 3600)
    if (signed.error) throw new Error(signed.error.message)
    for (const photo of photoRows) {
      const item = signed.data?.find(entry => entry.path === photo.storage_path)
      if (!item?.signedUrl) continue
      const forIssue = photoUrls.get(photo.issue_id) ?? []
      forIssue.push({ url: item.signedUrl, kind: photo.photo_kind, createdAt: photo.created_at })
      photoUrls.set(photo.issue_id, forIssue)
    }
  }
  const assignmentByIssue = new Map(assignments.map(item => [item.issue_id, item]))
  const profileById = new Map(profiles.map(item => [item.id, item.display_name]))
  return {
    issues: dbIssues.map(issue => {
      const assignment = assignmentByIssue.get(issue.id)
      const timestamp = new Date(issue.created_at)
      return {
        id: issue.id,
        displayId: `GC-${issue.id.slice(0, 6).toUpperCase()}`,
        organizationId: issue.organization_id,
        title: issue.title,
        description: issue.description,
        category: issue.category,
        priority: issue.priority,
        status: issue.status,
        area: wards.find(ward => ward.id === issue.ward_id)?.name ?? 'Village area',
        location: issue.location_text,
        reporter: profileById.get(issue.reporter_id) ?? 'Village resident',
        reporterId: issue.reporter_id,
        department: departments.find(department => department.id === issue.department_id)?.name ?? '',
        departmentId: issue.department_id ?? '',
        worker: assignment ? profileById.get(assignment.worker_id) ?? 'Assigned worker' : '',
        workerId: assignment?.worker_id ?? '',
        createdAt: timestamp.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        points: 0,
        photos: photoUrls.get(issue.id) ?? [],
      }
    }),
    lookups: {
      workers: workerMemberships.flatMap(member => {
        const profile = profiles.find(item => item.id === member.user_id)
        return profile ? [{ id: profile.id, displayName: profile.display_name }] : []
      }),
      departments: departments.map(item => ({ id: item.id, name: item.name })),
      wards: wards.map(item => ({ id: item.id, name: item.name })),
    },
  }
}

export async function loadVillageLeaderboard(organizationId: string, period: 'month' | 'six_months' | 'year'): Promise<LeaderboardMember[]> {
  if (!supabase) return []
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'six_months') start.setMonth(start.getMonth() - 5)
  if (period === 'year') start.setMonth(0)
  const ledgerResult = await supabase.from('points_ledger').select('user_id, points').eq('organization_id', organizationId).gte('created_at', start.toISOString())
  const ledger = failIfError(ledgerResult) as Array<{ user_id: string; points: number }>
  const totals = new Map<string, number>()
  for (const entry of ledger) totals.set(entry.user_id, (totals.get(entry.user_id) ?? 0) + entry.points)
  const members = [...totals.entries()].filter(([, points]) => points > 0)
  if (!members.length) return []
  const profilesResult = await supabase.from('profiles').select('id, display_name').in('id', members.map(([userId]) => userId))
  const profiles = failIfError(profilesResult) as Array<{ id: string; display_name: string }>
  return members.map(([id, points]) => ({ id, name: profiles.find(profile => profile.id === id)?.display_name ?? 'Village member', points })).sort((left, right) => right.points - left.points)
}

export async function loadMemberPoints(organizationId: string, userId: string) {
  if (!supabase) return 0
  const result = await supabase.from('points_ledger').select('points').eq('organization_id', organizationId).eq('user_id', userId)
  const entries = failIfError(result) as Array<{ points: number }>
  return entries.reduce((sum, entry) => sum + entry.points, 0)
}

export async function loadVillageMembers(organizationId: string): Promise<VillageMember[]> {
  if (!supabase) return []
  const membershipResult = await supabase.from('memberships').select('user_id, role, active').eq('organization_id', organizationId).order('created_at')
  const memberships = failIfError(membershipResult) as Array<{ user_id: string; role: Role; active: boolean }>
  if (!memberships.length) return []
  const profileResult = await supabase.from('profiles').select('id, display_name').in('id', memberships.map(item => item.user_id))
  const profiles = failIfError(profileResult) as Array<{ id: string; display_name: string }>
  return memberships.map(member => ({ userId: member.user_id, role: member.role, active: member.active, displayName: profiles.find(profile => profile.id === member.user_id)?.display_name ?? 'Village member' }))
}

export async function updateVillageMemberRole(organizationId: string, userId: string, role: Role) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.rpc('admin_set_member_role', { p_organization_id: organizationId, p_user_id: userId, p_role: role })
  if (result.error) throw new Error(result.error.message)
}

export async function setVillageMemberActive(organizationId: string, userId: string, active: boolean) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.rpc('admin_set_member_active', { p_organization_id: organizationId, p_user_id: userId, p_active: active })
  if (result.error) throw new Error(result.error.message)
}

export async function saveVillageWard(organizationId: string, name: string, landmarks: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.rpc('admin_save_ward', { p_organization_id: organizationId, p_name: name, p_landmarks: landmarks, p_active: true, p_ward_id: null })
  if (result.error) throw new Error(result.error.message)
}

export async function saveVillageDepartment(organizationId: string, name: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.rpc('admin_save_department', { p_organization_id: organizationId, p_name: name, p_active: true, p_department_id: null })
  if (result.error) throw new Error(result.error.message)
}

export async function loadVillageNotifications(organizationId: string): Promise<VillageNotification[]> {
  if (!supabase) return []
  const result = await supabase.from('notifications').select('id, issue_id, title, body, kind, read_at, created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(20)
  const rows = failIfError(result) as Array<{ id: string; issue_id: string | null; title: string; body: string; kind: string; read_at: string | null; created_at: string }>
  return rows.map(row => ({ id: row.id, issueId: row.issue_id, title: row.title, body: row.body, kind: row.kind, readAt: row.read_at, createdAt: row.created_at }))
}

export async function markVillageNotificationRead(notificationId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId)
  if (result.error) throw new Error(result.error.message)
}

export async function findSimilarVillageIssues(organizationId: string, title: string, description: string, category: string, wardId: string): Promise<SimilarVillageIssue[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.rpc('find_similar_issues', {
    p_organization_id: organizationId,
    p_title: title,
    p_description: description,
    p_category: category,
    p_ward_id: wardId || null,
  })
  const rows = failIfError(result) as Array<{ issue_id: string; category: string; status: Status; ward_name: string; created_at: string }>
  return rows.map(row => ({ id: row.issue_id, category: row.category, status: row.status, area: row.ward_name, createdAt: new Date(row.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }))
}

export async function joinVillage(slug: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const result = await supabase.rpc('join_village', { p_slug: slug })
  if (result.error) throw new Error(result.error.message)
  return result.data as string
}

export async function submitVillageIssue(organizationId: string, wardId: string, userId: string, issue: Issue, photo?: File) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const key = issue.idempotencyKey ?? crypto.randomUUID()
  const result = await supabase.rpc('submit_issue', {
    p_organization_id: organizationId,
    p_ward_id: wardId || null,
    p_title: issue.title,
    p_description: issue.description,
    p_category: issue.category,
    p_priority: issue.priority,
    p_location_text: issue.location,
    p_idempotency_key: key,
    p_latitude: issue.latitude ?? null,
    p_longitude: issue.longitude ?? null,
  })
  if (result.error) throw new Error(result.error.message)
  const issueId = result.data as string
  if (photo) {
    try { await uploadIssuePhoto(organizationId, issueId, userId, photo, 'report') }
    catch (error) { return { issueId, photoError: error instanceof Error ? error.message : 'The photo could not be uploaded.' } }
  }
  return { issueId, photoError: '' }
}

export async function uploadIssuePhoto(organizationId: string, issueId: string, userId: string, file: File, kind: 'report' | 'completion') {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Photos must be 10 MB or smaller.')
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${organizationId}/${issueId}/${userId}/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from('issue-photos').upload(path, file, { contentType: file.type, upsert: false })
  if (upload.error) throw new Error(upload.error.message)
  const registration = await supabase.rpc('register_issue_photo', {
    p_organization_id: organizationId,
    p_issue_id: issueId,
    p_photo_kind: kind,
    p_storage_path: path,
    p_content_type: file.type,
    p_byte_size: file.size,
  })
  if (registration.error) {
    await supabase.storage.from('issue-photos').remove([path])
    throw new Error(registration.error.message)
  }
}

export async function runIssueWorkflow(issue: Issue, actorId: string, updates: Partial<Issue>, photo?: File) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (updates.worker && updates.departmentId) {
    const assignment = await supabase.rpc('assign_issue', { p_issue_id: issue.id, p_worker_id: updates.workerId, p_department_id: updates.departmentId, p_reason: '' })
    if (assignment.error) throw new Error(assignment.error.message)
    return
  }
  if (updates.status === 'in_progress') {
    const started = await supabase.rpc('start_issue_work', { p_issue_id: issue.id })
    if (started.error) throw new Error(started.error.message)
    return
  }
  if (updates.status === 'resolution_submitted') {
    if (!photo) throw new Error('Add a completion photo before sending this task for review.')
    await uploadIssuePhoto(issue.organizationId ?? '', issue.id, actorId, photo, 'completion')
    const submitted = await supabase.rpc('submit_issue_resolution', { p_issue_id: issue.id, p_note: updates.resolutionNote ?? '' })
    if (submitted.error) throw new Error(submitted.error.message)
    return
  }
  if (updates.status === 'verified' || updates.status === 'reopened') {
    const reviewed = await supabase.rpc('review_issue_resolution', { p_issue_id: issue.id, p_decision: updates.status === 'verified' ? 'approved' : 'rejected', p_note: updates.resolutionNote ?? '' })
    if (reviewed.error) throw new Error(reviewed.error.message)
    return
  }
  throw new Error('That update is not available in the village workflow.')
}
