import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Bike, Building2,
  Camera, Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardCheck, Clock3, Droplets,
  Ellipsis, FileText, Filter, Flag, Home, Languages, Leaf, Lightbulb, LoaderCircle, MapPin, Menu,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Trash2, TrendingUp,
  Users, WalletCards, X, type LucideIcon,
} from 'lucide-react'
import { categories, departments, leaderboard, seedIssues, wards, workers } from './data'
import type { Issue, Role, Status } from './types'
import { AuthScreen, JoinVillageScreen, PasswordRecoveryScreen } from './AuthScreen'
import { findSimilarVillageIssues, getVillageProfile, getVillageWorkspaces, joinVillage, loadMemberPoints, loadVillageIssues, loadVillageLeaderboard, loadVillageMembers, loadVillageNotifications, markVillageNotificationRead, runIssueWorkflow, saveVillageDepartment, saveVillageWard, setVillageMemberActive, submitVillageIssue, updateVillageMemberRole, type LeaderboardMember, type SimilarVillageIssue, type VillageMember, type VillageNotification, type VillageProfile, type VillageWorkspace, type WorkspaceLookups } from './lib/village'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { assistReport, type ReportSuggestion } from './lib/ai'

type Page = 'overview' | 'reports' | 'tasks' | 'assignments' | 'village' | 'community' | 'settings'
type Language = 'en' | 'mr' | 'hi'
type NavItem = { id: Page; label: string; icon: LucideIcon; count?: number }
type DisplayLeader = LeaderboardMember & { ward: string; initials: string; color: 'lilac' | 'peach' | 'mint' | 'blue' }

const roleTitle: Record<Role, string> = { resident: 'Resident', worker: 'Field worker', supervisor: 'Supervisor', admin: 'Village admin' }
const translations: Record<Language, Record<string, string>> = {
  en: { overview: 'Overview', myReports: 'My reports', community: 'Community', tasks: 'My tasks', assignments: 'Assignments', allReports: 'All reports', village: 'Village overview', settings: 'Settings', welcome: 'Good morning', report: 'Report an issue', seeAll: 'See all', open: 'Open issues', resolved: 'Resolved this month', urgent: 'Need attention', points: 'My points', recent: 'Recent reports', activity: 'Recent activity', leaderboard: 'Community champions', viewBoard: 'View leaderboard', period: 'This month', all: 'All reports', search: 'Search reports', priority: 'Priority', status: 'Status', cancel: 'Cancel', submit: 'Submit report', assign: 'Assign task', start: 'Start work', sendReview: 'Send for review', verify: 'Verify repair', reopen: 'Reopen task', title: 'What needs attention?', description: 'Tell us a little more', category: 'Category', ward: 'Ward / area', location: 'Where is it?', photo: 'Add a photo', save: 'Save changes', back: 'Back to overview' },
  mr: { overview: 'आढावा', myReports: 'माझे अहवाल', community: 'समुदाय', tasks: 'माझी कामे', assignments: 'काम वाटप', allReports: 'सर्व अहवाल', village: 'गावाचा आढावा', settings: 'सेटिंग्ज', welcome: 'शुभ प्रभात', report: 'समस्या नोंदवा', seeAll: 'सर्व पहा', open: 'प्रलंबित समस्या', resolved: 'या महिन्यात सोडवले', urgent: 'लक्ष देणे आवश्यक', points: 'माझे गुण', recent: 'अलीकडील अहवाल', activity: 'अलीकडील हालचाली', leaderboard: 'समुदायातील पुढाकार', viewBoard: 'गुणफलक पहा', period: 'या महिन्यात', all: 'सर्व अहवाल', search: 'अहवाल शोधा', priority: 'प्राधान्य', status: 'स्थिती', cancel: 'रद्द करा', submit: 'अहवाल पाठवा', assign: 'काम सोपवा', start: 'काम सुरू करा', sendReview: 'तपासणीसाठी पाठवा', verify: 'दुरुस्ती तपासा', reopen: 'काम पुन्हा उघडा', title: 'कशाकडे लक्ष हवे?', description: 'थोडी अधिक माहिती द्या', category: 'विभाग', ward: 'प्रभाग / परिसर', location: 'ठिकाण', photo: 'फोटो जोडा', save: 'बदल जतन करा', back: 'आढाव्यावर परत' },
  hi: { overview: 'अवलोकन', myReports: 'मेरी रिपोर्ट', community: 'समुदाय', tasks: 'मेरे काम', assignments: 'कार्य आवंटन', allReports: 'सभी रिपोर्ट', village: 'गाँव का अवलोकन', settings: 'सेटिंग्स', welcome: 'सुप्रभात', report: 'समस्या दर्ज करें', seeAll: 'सभी देखें', open: 'खुली समस्याएँ', resolved: 'इस महीने हल हुईं', urgent: 'ध्यान देना ज़रूरी', points: 'मेरे अंक', recent: 'हाल की रिपोर्ट', activity: 'हाल की गतिविधि', leaderboard: 'समुदाय के नायक', viewBoard: 'लीडरबोर्ड देखें', period: 'इस महीने', all: 'सभी रिपोर्ट', search: 'रिपोर्ट खोजें', priority: 'प्राथमिकता', status: 'स्थिति', cancel: 'रद्द करें', submit: 'रिपोर्ट भेजें', assign: 'काम सौंपें', start: 'काम शुरू करें', sendReview: 'जाँच के लिए भेजें', verify: 'मरम्मत सत्यापित करें', reopen: 'काम फिर खोलें', title: 'किस बात पर ध्यान चाहिए?', description: 'थोड़ी और जानकारी दें', category: 'श्रेणी', ward: 'वार्ड / क्षेत्र', location: 'जगह', photo: 'फोटो जोड़ें', save: 'बदलाव सहेजें', back: 'अवलोकन पर वापस' },
}

const initialIssues = (): Issue[] => {
  try {
    const saved = localStorage.getItem('gram-clean-demo-issues')
    return saved ? JSON.parse(saved) as Issue[] : seedIssues
  } catch { return seedIssues }
}

function statusLabel(status: Status) {
  return ({ new: 'New', assigned: 'Assigned', in_progress: 'In progress', resolution_submitted: 'Review needed', verified: 'Verified', reopened: 'Reopened' })[status]
}

function priorityLabel(priority: Issue['priority']) { return priority === 'normal' ? 'Normal' : priority[0].toUpperCase() + priority.slice(1) }

function notificationAge(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function App() {
  const [role, setRole] = useState<Role>('resident')
  const [language, setLanguage] = useState<Language>('mr')
  const [page, setPage] = useState<Page>('overview')
  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [workspaces, setWorkspaces] = useState<VillageWorkspace[]>([])
  const [profile, setProfile] = useState<VillageProfile | null>(null)
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [lookups, setLookups] = useState<WorkspaceLookups>({ workers: [], departments: [], wards: [] })
  const [communityLeaders, setCommunityLeaders] = useState<DisplayLeader[]>([])
  const [myPointBalance, setMyPointBalance] = useState(0)
  const [pointsRefresh, setPointsRefresh] = useState(0)
  const [villageMembers, setVillageMembers] = useState<VillageMember[]>([])
  const [notifications, setNotifications] = useState<VillageNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const liveMode = isSupabaseConfigured
  const activeWorkspace = workspaces.find(workspace => workspace.organizationId === workspaceId) ?? workspaces[0]
  const userId = session?.user.id ?? ''
  const t = (key: string) => translations[language][key] ?? key

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    let alive = true
    if (window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('type') === 'recovery') setPasswordRecovery(true)
    void supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setAuthReady(true) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => { if (!liveMode) localStorage.setItem('gram-clean-demo-issues', JSON.stringify(issues)) }, [issues, liveMode])
  useEffect(() => {
    if (!liveMode || !session) { setWorkspaces([]); setProfile(null); setWorkspaceId(''); setWorkspaceError(''); return }
    let alive = true
    setWorkspaceLoading(true)
    setWorkspaceError('')
    void Promise.all([getVillageWorkspaces(session), getVillageProfile(session.user.id)]).then(([nextWorkspaces, nextProfile]) => {
      if (!alive) return
      setWorkspaces(nextWorkspaces)
      setProfile(nextProfile)
      setWorkspaceId(current => nextWorkspaces.some(item => item.organizationId === current) ? current : nextWorkspaces[0]?.organizationId ?? '')
      if (nextWorkspaces[0]) { setRole(nextWorkspaces[0].role); setLanguage((nextProfile?.preferredLanguage as Language | undefined) ?? 'mr') }
    }).catch(error => { if (alive) setWorkspaceError(error instanceof Error ? error.message : 'Village workspace could not be loaded.') }).finally(() => { if (alive) setWorkspaceLoading(false) })
    return () => { alive = false }
  }, [liveMode, userId])
  useEffect(() => {
    if (!liveMode || !activeWorkspace) return
    let alive = true
    setWorkspaceLoading(true)
    void loadVillageIssues(activeWorkspace.organizationId).then(data => {
      if (!alive) return
      setIssues(data.issues)
      setLookups(data.lookups)
      setRole(activeWorkspace.role)
    }).catch(error => { if (alive) setWorkspaceError(error instanceof Error ? error.message : 'Village reports could not be loaded.') }).finally(() => { if (alive) setWorkspaceLoading(false) })
    return () => { alive = false }
  }, [liveMode, workspaceId, activeWorkspace?.organizationId])
  useEffect(() => {
    if (!liveMode || !activeWorkspace || !userId) return
    let alive = true
    const colors: DisplayLeader['color'][] = ['lilac', 'peach', 'mint', 'blue']
    void Promise.all([loadVillageLeaderboard(activeWorkspace.organizationId, 'month'), loadMemberPoints(activeWorkspace.organizationId, userId)]).then(([leaders, points]) => {
      if (!alive) return
      setCommunityLeaders(leaders.map((item, index) => ({ ...item, ward: 'Village member', initials: item.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase(), color: colors[index % colors.length] })))
      setMyPointBalance(points)
    }).catch(error => { if (alive) setWorkspaceError(error instanceof Error ? error.message : 'Community points could not be loaded.') })
    return () => { alive = false }
  }, [liveMode, workspaceId, userId, activeWorkspace?.organizationId, pointsRefresh])
  useEffect(() => {
    if (!liveMode || !activeWorkspace || role !== 'admin') { setVillageMembers([]); return }
    let alive = true
    void loadVillageMembers(activeWorkspace.organizationId).then(members => { if (alive) setVillageMembers(members) }).catch(error => { if (alive) setToast(error instanceof Error ? error.message : 'Village members could not be loaded.') })
    return () => { alive = false }
  }, [liveMode, workspaceId, userId, role, activeWorkspace?.organizationId])
  useEffect(() => {
    if (!liveMode || !activeWorkspace) { setNotifications([]); return }
    let alive = true
    void loadVillageNotifications(activeWorkspace.organizationId).then(rows => { if (alive) setNotifications(rows) }).catch(error => { if (alive) setWorkspaceError(error instanceof Error ? error.message : 'Notifications could not be loaded.') })
    return () => { alive = false }
  }, [liveMode, workspaceId, activeWorkspace?.organizationId, pointsRefresh])
  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navItems: NavItem[] = useMemo(() => {
    const shared: NavItem[] = [{ id: 'overview', label: t('overview'), icon: Home }]
    if (role === 'resident') return [...shared, { id: 'reports', label: t('myReports'), icon: FileText, count: issues.filter(x => (liveMode ? x.reporterId === userId : x.reporter === 'Anita Patil') && x.status !== 'verified').length }, { id: 'community', label: t('community'), icon: Users }]
    if (role === 'worker') return [...shared, { id: 'tasks', label: t('tasks'), icon: ClipboardCheck, count: issues.filter(x => (liveMode ? x.workerId === userId : x.worker === 'Ramesh Jadhav') && x.status !== 'verified').length }, { id: 'community', label: t('community'), icon: Users }]
    if (role === 'supervisor') return [...shared, { id: 'assignments', label: t('assignments'), icon: ClipboardCheck }, { id: 'reports', label: t('allReports'), icon: FileText, count: issues.filter(x => x.status === 'resolution_submitted' || x.status === 'new').length }, { id: 'community', label: t('community'), icon: Users }]
    return [...shared, { id: 'village', label: t('village'), icon: Building2 }, { id: 'reports', label: t('allReports'), icon: FileText }, { id: 'community', label: t('community'), icon: Users }, { id: 'settings', label: t('settings'), icon: Settings2 }]
  }, [role, issues, language, liveMode, userId])

  const selectedIssue = issues.find(issue => issue.id === selectedId) ?? null
  const visibleIssues = useMemo(() => {
    let result = [...issues]
    if (role === 'resident') result = result.filter(issue => liveMode ? issue.reporterId === userId : issue.reporter === 'Anita Patil')
    if (role === 'worker') result = result.filter(issue => liveMode ? issue.workerId === userId : issue.worker === 'Ramesh Jadhav')
    if (page === 'tasks') result = result.filter(issue => issue.status !== 'verified')
    if (page === 'assignments') result = result.filter(issue => issue.status !== 'verified')
    if (search.trim()) result = result.filter(issue => `${issue.id} ${issue.title} ${issue.location} ${issue.category}`.toLowerCase().includes(search.toLowerCase()))
    return result
  }, [issues, page, role, search, liveMode, userId])

  function resetDemo() {
    if (liveMode) return
    setIssues(seedIssues)
    setPage('overview')
    setSelectedId(null)
    setToast('Sample village data restored')
  }

  function changeRole(nextRole: Role) {
    if (liveMode) return
    setRole(nextRole)
    setPage('overview')
    setSelectedId(null)
    setMobileNavOpen(false)
  }

  async function handleReportSubmit(issue: Issue, photo?: File) {
    if (liveMode) {
      if (!activeWorkspace || !session) throw new Error('Join a village before submitting a report.')
      const wardId = lookups.wards.find(item => item.name === issue.area)?.id ?? ''
      if (!wardId) throw new Error('This village has not added any wards yet. Ask a village administrator to set them up.')
      const result = await submitVillageIssue(activeWorkspace.organizationId, wardId, session.user.id, issue, photo)
      const fresh = await loadVillageIssues(activeWorkspace.organizationId)
      setIssues(fresh.issues)
      setLookups(fresh.lookups)
      setReportOpen(false)
      setPage('reports')
      setPointsRefresh(version => version + 1)
      setToast(result.photoError ? `Report submitted. Photo upload failed: ${result.photoError}` : 'Your report was submitted to the village.')
      return
    }
    setIssues(current => [issue, ...current])
    setReportOpen(false)
    setPage('reports')
    setRole('resident')
    setToast('Your report was added to this local demo')
  }

  async function handleIssueUpdate(issue: Issue, updates: Partial<Issue>, photo?: File) {
    if (liveMode) {
      if (!session || !activeWorkspace) throw new Error('Your village session has expired. Sign in again.')
      await runIssueWorkflow(issue, session.user.id, updates, photo)
      const fresh = await loadVillageIssues(activeWorkspace.organizationId)
      setIssues(fresh.issues)
      setLookups(fresh.lookups)
      setPointsRefresh(version => version + 1)
      return
    }
    setIssues(current => current.map(item => item.id === issue.id ? { ...item, ...updates } : item))
  }

  async function refreshVillageAdminData() {
    if (!activeWorkspace) return
    const [members, data] = await Promise.all([loadVillageMembers(activeWorkspace.organizationId), loadVillageIssues(activeWorkspace.organizationId)])
    setVillageMembers(members)
    setIssues(data.issues)
    setLookups(data.lookups)
  }

  async function openNotification(notification: VillageNotification) {
    if (liveMode && !notification.readAt) {
      try {
        await markVillageNotificationRead(notification.id)
        setNotifications(rows => rows.map(row => row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row))
      } catch (error) { setToast(error instanceof Error ? error.message : 'Notification could not be marked read.') }
    }
    setNotificationsOpen(false)
    if (notification.issueId) {
      setPage('reports')
      setSelectedId(notification.issueId)
    }
  }

  async function handleJoinVillage(slug: string) {
    await joinVillage(slug)
    if (session) {
      const nextWorkspaces = await getVillageWorkspaces(session)
      setWorkspaces(nextWorkspaces)
      setWorkspaceId(nextWorkspaces[0]?.organizationId ?? '')
      if (nextWorkspaces[0]) setRole(nextWorkspaces[0].role)
    }
  }

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage)
    if (liveMode && userId && supabase) {
      void supabase.from('profiles').update({ preferred_language: nextLanguage }).eq('id', userId).then(({ error }) => {
        if (error) setToast(`Could not save language preference: ${error.message}`)
      })
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setWorkspaces([])
    setWorkspaceId('')
    setPage('overview')
  }

  function switchWorkspace(nextId: string) {
    if (nextId === workspaceId) return
    setWorkspaceId(nextId)
    setSelectedId(null)
    setPage('overview')
    setSearch('')
    setNotificationsOpen(false)
    setWorkspaceError('')
  }

  if (liveMode && !authReady) return <div className="auth-loading"><LoaderCircle className="spin" size={22} /> Connecting securely…</div>
  if (liveMode && passwordRecovery) return <PasswordRecoveryScreen onComplete={() => {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
    setPasswordRecovery(false)
  }} />
  if (liveMode && !session) return <AuthScreen />
  if (liveMode && session && workspaceLoading) return <div className="auth-loading"><LoaderCircle className="spin" size={22} /> Loading your village…</div>
  if (liveMode && session && workspaceError && workspaces.length === 0) return <div className="auth-loading auth-load-error"><p>{workspaceError}</p><button className="outline-button" onClick={() => void signOut()}>Sign out</button></div>
  if (liveMode && session && workspaces.length === 0) return <JoinVillageScreen displayName={profile?.displayName ?? session.user.email?.split('@')[0] ?? 'there'} onJoin={handleJoinVillage} onSignOut={() => { void signOut() }} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row"><div className="brand-mark"><Leaf size={22} strokeWidth={2.3} /></div><div className="brand-copy"><b>gram clean</b><span>Village care, together</span></div><button className="icon-button nav-close" aria-label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
        <div className="village-switcher"><span className="village-symbol"><Building2 size={17} /></span><span className="village-switcher-copy">{workspaces.length > 1 ? <><b>Village workspace</b><select className="workspace-switch-select" aria-label="Switch village workspace" value={workspaceId} onChange={event => switchWorkspace(event.target.value)}>{workspaces.map(workspace => <option key={workspace.organizationId} value={workspace.organizationId}>{workspace.organizationName} · {workspace.slug}</option>)}</select></> : <><b>{activeWorkspace?.organizationName ?? 'Sonapur village'}</b><small>{activeWorkspace ? activeWorkspace.slug : 'Ratnagiri, Maharashtra'}</small></>}</span><ChevronDown size={15} className="muted-icon" /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(item => <button key={item.id} className={`nav-link ${page === item.id ? 'nav-active' : ''}`} onClick={() => { setPage(item.id); setMobileNavOpen(false); setSearch('') }}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.count ? <span className="nav-count">{item.count}</span> : null}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><b>Need a hand?</b><p>We’re here to help your village run smoothly.</p><button onClick={() => setToast('Support resources are coming soon')}>Get support <ArrowRight size={14} /></button></div>
          <button className="account-row" onClick={() => liveMode ? void signOut() : setToast(`Previewing ${roleTitle[role].toLowerCase()} view`)}><div className="avatar avatar-olive">{liveMode ? (profile?.displayName ?? 'GC').split(' ').map(word => word[0]).join('').slice(0, 2) : role === 'worker' ? 'RJ' : role === 'admin' ? 'SP' : role === 'supervisor' ? 'SM' : 'AP'}</div><span className="account-copy"><b>{liveMode ? profile?.displayName ?? session?.user.email : role === 'worker' ? 'Ramesh Jadhav' : role === 'admin' ? 'Sanjay Patil' : role === 'supervisor' ? 'Sunita More' : 'Anita Patil'}</b><small>{liveMode ? `${roleTitle[role]} · sign out` : roleTitle[role]}</small></span><Ellipsis size={18} className="muted-icon" /></button>
        </div>
      </aside>
      {mobileNavOpen && <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>{activeWorkspace?.organizationName ?? 'Sonapur'}</span><span className="crumb-slash">/</span><b>{navItems.find(item => item.id === page)?.label ?? t('overview')}</b></div>
          <div className="topbar-tools"><div className="demo-badge"><span />{liveMode ? 'Live village' : 'Demo mode'}</div><label className="language-select" aria-label="Choose language"><Languages size={15} /><select value={language} onChange={event => changeLanguage(event.target.value as Language)}><option value="mr">मराठी</option><option value="hi">हिन्दी</option><option value="en">English</option></select><ChevronDown size={12} /></label><div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { if (!liveMode) { setToast('Notifications appear when you connect a village.'); return } setNotificationsOpen(open => !open) }}><Bell size={18} />{liveMode && notifications.some(item => !item.readAt) && <i />}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-popover-head"><b>Notifications</b><span>{notifications.filter(item => !item.readAt).length} unread</span></div>{notifications.length ? notifications.slice(0, 8).map(item => <button key={item.id} className={`notification-row ${item.readAt ? 'notification-read' : ''}`} onClick={() => { void openNotification(item) }}><span className="notification-dot"><Bell size={13} /></span><span className="notification-copy"><b>{item.title}</b><small>{item.body || 'There is an update on a village report.'}</small><time>{notificationAge(item.createdAt)}</time></span>{!item.readAt && <i />}</button>) : <p className="notifications-empty">You’re all caught up. New village updates will appear here.</p>}</div>}</div><div className="top-divider" />{liveMode ? <div className="role-picker"><span>{roleTitle[role]}</span></div> : <div className="role-picker"><span>Preview as</span><select aria-label="Preview as role" value={role} onChange={event => changeRole(event.target.value as Role)}><option value="resident">Resident</option><option value="worker">Field worker</option><option value="supervisor">Supervisor</option><option value="admin">Village admin</option></select><ChevronDown size={13} /></div>}</div>
        </header>
        <div className="demo-notice"><Sparkles size={14} /><span><b>{liveMode ? 'Connected village workspace' : 'Interactive preview'}</b> {liveMode ? `Updates are saved to ${activeWorkspace?.organizationName ?? 'your village'} database.` : 'Sample data lives in this browser only.'}</span>{!liveMode && <button onClick={resetDemo}>Reset demo data</button>}</div>
        <div className="page-content">
          {page === 'overview' && <Overview role={role} issues={issues} t={t} onReport={() => setReportOpen(true)} onOpenIssue={setSelectedId} onPage={setPage} userName={liveMode ? profile?.displayName : undefined} villageName={activeWorkspace?.organizationName} liveMode={liveMode} leaders={communityLeaders} myPointBalance={myPointBalance} />}
          {(page === 'reports' || page === 'tasks' || page === 'assignments') && <IssueList role={role} page={page} issues={visibleIssues} query={search} setQuery={setSearch} t={t} onOpenIssue={setSelectedId} onReport={() => setReportOpen(true)} />}
          {page === 'community' && <Community onBack={() => setPage('overview')} t={t} liveMode={liveMode} organizationId={activeWorkspace?.organizationId ?? ''} />}
          {page === 'village' && <VillageOverview issues={issues} t={t} onOpenIssue={setSelectedId} liveMode={liveMode} villageName={activeWorkspace?.organizationName ?? 'Sonapur village'} wardNames={liveMode ? lookups.wards.map(item => item.name) : wards} departmentNames={liveMode ? lookups.departments.map(item => item.name) : departments} role={role} members={villageMembers} actorId={userId} organizationId={activeWorkspace?.organizationId ?? ''} onRefreshAdmin={refreshVillageAdminData} onMessage={setToast} />}
          {page === 'settings' && <Settings language={language} setLanguage={changeLanguage} onReset={resetDemo} t={t} liveMode={liveMode} />}
        </div>
        <footer className="app-footer"><span>Made for healthier, happier villages</span><span><ShieldCheck size={13} /> Your village, your voice</span></footer>
      </main>

      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} onSubmit={handleReportSubmit} t={t} liveMode={liveMode} wards={liveMode ? lookups.wards.map(item => item.name) : wards} wardIds={Object.fromEntries(lookups.wards.map(item => [item.name, item.id]))} issues={issues} organizationId={activeWorkspace?.organizationId ?? ''} language={language} />}
      {selectedIssue && <IssueModal issue={selectedIssue} role={role} onClose={() => setSelectedId(null)} onUpdate={(updates, photo) => handleIssueUpdate(selectedIssue, updates, photo)} t={t} onToast={setToast} lookups={liveMode ? lookups : undefined} liveMode={liveMode} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  )
}

function Overview({ role, issues, t, onReport, onOpenIssue, onPage, userName, villageName, liveMode, leaders, myPointBalance }: { role: Role; issues: Issue[]; t: (key: string) => string; onReport: () => void; onOpenIssue: (id: string) => void; onPage: (page: Page) => void; userName?: string; villageName?: string; liveMode: boolean; leaders: DisplayLeader[]; myPointBalance: number }) {
  const openCount = issues.filter(issue => issue.status !== 'verified').length
  const resolvedCount = issues.filter(issue => issue.status === 'verified').length
  const reviewCount = issues.filter(issue => issue.status === 'resolution_submitted').length
  const heroTitle = role === 'resident' ? 'A cleaner village starts with you.' : role === 'worker' ? 'Good work makes a visible difference.' : role === 'supervisor' ? 'Keep every village task moving.' : 'A clearer picture of village care.'
  const heroText = role === 'resident' ? 'See something that needs fixing? Let’s get the right people on it.' : role === 'worker' ? 'Your assigned tasks are ready when you are. Keep residents in the loop.' : role === 'supervisor' ? 'Review new reports, assign the right team and check completed work.' : 'Track issues, team progress and community participation across Sonapur.'
  const greetingName = userName?.split(' ')[0] ?? (role === 'worker' ? 'Ramesh' : role === 'admin' ? 'Sanjay' : role === 'supervisor' ? 'Sunita' : 'Anita')
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  const myPoints = liveMode ? myPointBalance : issues.filter(issue => issue.reporter === 'Anita Patil').reduce((total, issue) => total + issue.points, 0) + 18
  const topPeople = liveMode ? leaders : leaderboard
  return <>
    <div className="welcome-line"><div><p className="eyebrow">{today} <span>·</span> {villageName?.toUpperCase() ?? 'SONAPUR VILLAGE'}</p><h1>{t('welcome')}, {greetingName} <span className="wave">☀</span></h1><p className="welcome-sub">{heroText}</p></div><button className="date-button"><Clock3 size={15} /> Last 30 days <ChevronDown size={14} /></button></div>
    <section className="hero-card"><div className="hero-content"><div className="hero-kicker"><span className="hero-kicker-icon"><Leaf size={14} /></span> SMALL ACTIONS, BIG CHANGE</div><h2>{heroTitle}</h2><p>{role === 'resident' ? 'Your report helps neighbours see what’s happening and helps local teams take action.' : heroText}</p><button className="hero-button" onClick={() => role === 'resident' ? onReport() : onPage(role === 'worker' ? 'tasks' : role === 'supervisor' ? 'assignments' : 'village')}>{role === 'resident' ? <><Plus size={17} /> {t('report')}</> : <>{role === 'worker' ? t('tasks') : role === 'supervisor' ? t('assignments') : t('village')} <ArrowRight size={16} /></>}</button></div><VillageIllustration /></section>

    <section className="metrics-grid" aria-label="Village issue summary">
      <MetricCard icon={FileText} iconTone="sage" label={t('open')} value={String(openCount).padStart(2, '0')} foot={<><span className="tiny-dot dot-blue" /> {liveMode ? 'Current village reports' : 'Across 3 wards'}</>} trend={liveMode ? <span>Live data</span> : <><ArrowDownRight size={13} /> 12% <span>vs last month</span></>} />
      <MetricCard icon={CheckCircle2} iconTone="mint" label={liveMode ? 'Verified repairs' : t('resolved')} value={String(resolvedCount).padStart(2, '0')} foot={<><span className="tiny-dot dot-green" /> {liveMode ? 'Supervisor reviewed' : 'Great progress'}</>} trend={liveMode ? <span>Live data</span> : <><ArrowUpRight size={13} /> 8% <span>vs last month</span></>} />
      <MetricCard icon={Flag} iconTone="peach" label={t('urgent')} value={String(issues.filter(issue => issue.priority === 'urgent' && issue.status !== 'verified').length).padStart(2, '0')} foot={<><span className="tiny-dot dot-orange" /> Needs a quick look</>} trend={role === 'supervisor' || role === 'admin' ? <><span>{reviewCount} waiting for review</span></> : <><span>We’re on it</span></>} />
      <MetricCard icon={WalletCards} iconTone="lilac" label={role === 'resident' ? t('points') : 'Community points'} value={liveMode && leaders.length === 0 && role !== 'resident' ? '0' : role === 'resident' ? String(myPoints) : liveMode ? String(leaders.reduce((sum, item) => sum + item.points, 0)) : '248'} foot={<><span className="tiny-dot dot-purple" /> {role === 'resident' ? 'Your verified contributions' : 'Village leaderboard'}</>} trend={<button className="text-link" onClick={() => onPage('community')}>{t('viewBoard')} <ArrowRight size={13} /></button>} />
    </section>

    <div className="content-grid"><section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">ON THE GROUND</p><h3>{t('recent')}</h3></div><button className="link-button" onClick={() => onPage(role === 'worker' ? 'tasks' : 'reports')}>{t('seeAll')} <ArrowRight size={15} /></button></div><div className="activity-list">{issues.slice(0, 4).map(issue => <button className="activity-row" key={issue.id} onClick={() => onOpenIssue(issue.id)}><IssueIcon category={issue.category} /><span className="activity-copy"><span><b>{issue.title}</b><small><MapPin size={12} /> {issue.area} · {issue.location}</small></span></span><span className={`status-pill status-${issue.status}`}>{statusLabel(issue.status)}</span><span className="activity-priority"><i className={`priority-dot priority-${issue.priority}`} /> {priorityLabel(issue.priority)}</span><ArrowRight size={15} className="row-arrow" /></button>)}</div></section>
      <section className="panel community-panel"><div className="panel-header"><div><p className="eyebrow">NEIGHBOURS MAKING A DIFFERENCE</p><h3>{t('leaderboard')}</h3></div><button className="icon-button" onClick={() => onPage('community')} aria-label="Open leaderboard"><ArrowUpRight size={17} /></button></div>{topPeople.length ? <div className="leaderboard-mini">{topPeople.slice(0, 3).map((person, index) => <div className="leader-row" key={person.name}><span className="leader-rank">{String(index + 1).padStart(2, '0')}</span><div className={`avatar avatar-${person.color}`}>{person.initials}</div><span className="leader-person"><b>{person.name}</b><small>{person.ward}</small></span><strong>{person.points}<small> pts</small></strong></div>)}</div> : <p className="panel-empty">Verified village contributions will appear here.</p>}<button className="full-link" onClick={() => onPage('community')}>{t('viewBoard')} <ArrowRight size={14} /></button></section></div>
  </>
}

function MetricCard({ icon: Icon, iconTone, label, value, foot, trend }: { icon: LucideIcon; iconTone: string; label: string; value: string; foot: ReactNode; trend: ReactNode }) {
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${iconTone}`}><Icon size={18} strokeWidth={1.8} /></span><span className="metric-trend">{trend}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-foot">{foot}</div></div>
}

function IssueIcon({ category }: { category: string }) {
  const Icon = category.toLowerCase().includes('water') || category.toLowerCase().includes('drain') ? Droplets : category.toLowerCase().includes('street') ? Lightbulb : category.toLowerCase().includes('road') ? Bike : Trash2
  return <span className="issue-icon"><Icon size={17} strokeWidth={1.8} /></span>
}

function VillageIllustration() {
  return <div className="village-art" aria-hidden="true"><div className="art-sun" /><div className="art-cloud cloud-one" /><div className="art-cloud cloud-two" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="art-house house-one"><i /><b /><span /></div><div className="art-house house-two"><i /><b /><span /></div><div className="art-house house-three"><i /><b /><span /></div><div className="art-tree tree-one"><i /><b /></div><div className="art-tree tree-two"><i /><b /></div><div className="art-tree tree-three"><i /><b /></div><div className="art-path" /><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✳</div></div>
}

function IssueList({ role, page, issues, query, setQuery, t, onOpenIssue, onReport }: { role: Role; page: Page; issues: Issue[]; query: string; setQuery: (value: string) => void; t: (key: string) => string; onOpenIssue: (id: string) => void; onReport: () => void }) {
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Issue['priority']>('all')
  const title = page === 'tasks' ? 'My assigned tasks' : page === 'assignments' ? 'Work assignments' : role === 'resident' ? t('myReports') : t('allReports')
  const subtitle = page === 'tasks' ? 'A clear view of the work assigned to you.' : page === 'assignments' ? 'Triage new reports and follow repairs through to review.' : role === 'resident' ? 'Follow your reports from the first update to resolution.' : 'Every report submitted by the Sonapur community.'
  const filteredIssues = issues.filter(issue => (statusFilter === 'all' || issue.status === statusFilter) && (priorityFilter === 'all' || issue.priority === priorityFilter))
  const clearFilters = () => { setStatusFilter('all'); setPriorityFilter('all'); setQuery('') }
  return <><div className="page-heading"><div><p className="eyebrow">SONAPUR VILLAGE <span>·</span> WARD 1–3</p><h1>{title}</h1><p>{subtitle}</p></div>{role === 'resident' && <button className="primary-button" onClick={onReport}><Plus size={17} /> {t('report')}</button>}</div>
    <div className="list-toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search')} /></label><label className="filter-button filter-control"><Filter size={16} /><select aria-label="Filter reports by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | Status)}><option value="all">{t('status')}: All</option>{(['new', 'assigned', 'in_progress', 'resolution_submitted', 'verified', 'reopened'] as Status[]).map(status => <option value={status} key={status}>{statusLabel(status)}</option>)}</select><ChevronDown size={14} /></label><label className="filter-button filter-control"><Flag size={15} /><select aria-label="Filter reports by priority" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as 'all' | Issue['priority'])}><option value="all">{t('priority')}: All</option>{(['urgent', 'high', 'normal', 'low'] as Issue['priority'][]).map(priority => <option value={priority} key={priority}>{priorityLabel(priority)}</option>)}</select><ChevronDown size={14} /></label><span className="results-count">{filteredIssues.length} {filteredIssues.length === 1 ? 'report' : 'reports'}</span></div>
    {filteredIssues.length ? <div className="issue-table">{filteredIssues.map(issue => <button className="issue-table-row" key={issue.id} onClick={() => onOpenIssue(issue.id)}><IssueIcon category={issue.category} /><span className="table-main"><b>{issue.title}</b><small>{issue.displayId ?? issue.id} <span>·</span> {issue.area} <span>·</span> {issue.category}</small></span><span className={`status-pill status-${issue.status}`}>{statusLabel(issue.status)}</span><span className="table-assignee">{issue.worker || 'Awaiting assignment'}</span><span className="table-date">{issue.createdAt}</span><ArrowRight size={15} className="row-arrow" /></button>)}</div> : statusFilter !== 'all' || priorityFilter !== 'all' ? <div className="empty-state"><Filter size={28} /><h3>No matching reports</h3><p>Change the filters or clear them to see reports again.</p><button className="outline-button" onClick={clearFilters}>Clear filters</button></div> : query.trim() ? <div className="empty-state"><Search size={28} /><h3>No reports match your search</h3><p>Try another title, location or category.</p><button className="outline-button" onClick={() => setQuery('')}>Clear search</button></div> : <div className="empty-state"><FileText size={28} /><h3>No reports to show</h3><p>New reports and updates will appear here.</p></div>}
  </>
}

function Community({ onBack, t, liveMode, organizationId }: { onBack: () => void; t: (key: string) => string; liveMode: boolean; organizationId: string }) {
  const [period, setPeriod] = useState<'month' | 'six_months' | 'year'>('month')
  const [livePeople, setLivePeople] = useState<DisplayLeader[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const periodLabels = { month: 'This month', six_months: 'Last 6 months', year: 'This year' }
  useEffect(() => {
    if (!liveMode || !organizationId) return
    let alive = true
    setLoading(true)
    setLoadError('')
    const colors: DisplayLeader['color'][] = ['lilac', 'peach', 'mint', 'blue']
    void loadVillageLeaderboard(organizationId, period).then(entries => {
      if (alive) setLivePeople(entries.map((item, index) => ({ ...item, ward: 'Village member', initials: item.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase(), color: colors[index % colors.length] })))
    }).catch(error => { if (alive) setLoadError(error instanceof Error ? error.message : 'Leaderboard could not be loaded.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [liveMode, organizationId, period])
  const people = liveMode ? livePeople : leaderboard
  const pointsTotal = people.reduce((sum, person) => sum + person.points, 0)
  return <><div className="page-heading"><div><p className="eyebrow">GOOD THINGS GROW WHEN WE WORK TOGETHER</p><h1>{t('community')}</h1><p>Every verified contribution helps make your village a better place to live.</p></div><label className="filter-button period-select"><Clock3 size={15} /><select aria-label="Leaderboard period" value={period} onChange={event => setPeriod(event.target.value as typeof period)}>{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={13} /></label></div>
    <div className="community-summary"><div className="community-sun"><Sparkles size={20} /></div><div><b>Small actions add up.</b><p>Verified reports earn 2 points; completed repairs earn 1. Supervisors verify contributions.</p></div><div className="summary-stat"><strong>{pointsTotal}</strong><small>points earned</small></div><div className="summary-stat"><strong>{people.length}</strong><small>neighbours involved</small></div></div>
    <section className="panel leaderboard-panel"><div className="panel-header"><div><p className="eyebrow">{periodLabels[period].toUpperCase()} · VILLAGE</p><h3>{t('leaderboard')}</h3></div><span className="privacy-note"><ShieldCheck size={14} /> Village members only</span></div>{loadError && <p className="form-error" role="alert">{loadError}</p>}{loading ? <p className="panel-empty">Loading village contributions…</p> : people.length ? <div className="leaderboard-table">{people.map((person, index) => <div className={`leaderboard-row ${index === 0 ? 'leader-first' : ''}`} key={person.name}><span className="leader-rank large-rank">{String(index + 1).padStart(2, '0')}</span><div className={`avatar avatar-${person.color}`}>{person.initials}</div><span className="leader-person"><b>{person.name}</b><small>{person.ward}</small></span>{index === 0 && <span className="champion-tag"><BadgeCheck size={14} /> Village champion</span>}<strong className="leader-points">{person.points}<small> pts</small></strong></div>)}</div> : <p className="panel-empty">Verified contributions for this period will appear here.</p>}</section><button className="back-link" onClick={onBack}>← {t('back')}</button></>
}

function VillageOverview({ issues, t, onOpenIssue, liveMode, villageName, wardNames, departmentNames, role, members, actorId, organizationId, onRefreshAdmin, onMessage }: { issues: Issue[]; t: (key: string) => string; onOpenIssue: (id: string) => void; liveMode: boolean; villageName: string; wardNames: string[]; departmentNames: string[]; role: Role; members: VillageMember[]; actorId: string; organizationId: string; onRefreshAdmin: () => Promise<void>; onMessage: (message: string) => void }) {
  const areas = liveMode ? wardNames : wardNames.length ? wardNames : wards
  const wardsStats = areas.map((ward, index) => {
    const matching = issues.filter(issue => issue.area === ward)
    return { ward, total: matching.length + (liveMode ? 0 : [5, 3, 2][index] ?? 1), resolved: matching.filter(issue => issue.status === 'verified').length + (liveMode ? 0 : [3, 2, 1][index] ?? 1) }
  })
  const resolvedCount = issues.filter(issue => issue.status === 'verified').length + (liveMode ? 0 : 18)
  const memberCount = liveMode ? members.filter(member => member.active).length : 37
  const activeReporters = new Set(issues.map(issue => issue.reporterId ?? issue.reporter)).size
  return <>
    <div className="page-heading"><div><p className="eyebrow">{villageName.toUpperCase()} · ADMINISTRATION</p><h1>{t('village')}</h1><p>A village-wide view of reports, response and community participation.</p></div><span className="period-static"><Clock3 size={15} /> Current village data</span></div>
    <section className="village-banner"><div className="banner-icon"><Building2 size={21} /></div><div><b>{villageName}</b><p>{liveMode ? `${areas.length} active wards and areas` : 'Ratnagiri district · Maharashtra · 3 wards'}</p></div><span className="live-label"><i /> {liveMode ? 'Live workspace' : 'Demo workspace'}</span></section>
    <div className="admin-stat-grid">
      <MetricCard icon={FileText} iconTone="sage" label={t('open')} value={String(issues.filter(issue => issue.status !== 'verified').length).padStart(2, '0')} foot="Current report records" trend={liveMode ? <span>Live data</span> : <><ArrowDownRight size={13} /> 12% <span>this month</span></>} />
      <MetricCard icon={CheckCircle2} iconTone="mint" label="Verified repairs" value={String(resolvedCount).padStart(2, '0')} foot="Confirmed by supervisors" trend={liveMode ? <span>Live data</span> : <><ArrowUpRight size={13} /> 8% <span>this month</span></>} />
      <MetricCard icon={Clock3} iconTone="peach" label="Average response" value={liveMode ? '—' : '2.4d'} foot={liveMode ? 'Not calculated yet' : 'From report to first action'} trend={<span>{liveMode ? 'Needs more history' : 'Demo estimate'}</span>} />
      <MetricCard icon={Users} iconTone="lilac" label="Active members" value={String(memberCount)} foot={liveMode ? 'Village accounts' : 'Sample participation'} trend={liveMode ? <span>{activeReporters} recent reporters</span> : <><TrendingUp size={13} /> 5 <span>new this week</span></>} />
    </div>
    <section className="panel ward-panel"><div className="panel-header"><div><p className="eyebrow">WHERE REPORTS COME FROM</p><h3>Ward activity</h3></div></div><div className="ward-list">{wardsStats.map((item, index) => <div className="ward-row" key={item.ward}><div className={`ward-mark ward-mark-${index % 3 + 1}`}>{index + 1}</div><div className="ward-name"><b>{item.ward}</b><small>{liveMode ? 'Reports in this village area' : index === 1 ? 'Main road · Market area' : index === 0 ? 'Temple · Community centre' : 'School lane · Riverside'}</small></div><div className="ward-progress"><div className="progress-track"><i style={{ width: `${item.total ? Math.round(item.resolved / item.total * 100) : 0}%` }} /></div><small>{item.resolved} of {item.total} verified</small></div><span className="ward-total">{item.total}<small> reports</small></span></div>)}</div></section>
    <section className="panel"><div className="panel-header"><div><p className="eyebrow">NEEDS A DECISION</p><h3>Waiting for review</h3></div></div>{issues.filter(issue => issue.status === 'resolution_submitted').map(issue => <button className="activity-row compact-row" key={issue.id} onClick={() => onOpenIssue(issue.id)}><IssueIcon category={issue.category} /><span className="activity-copy"><span><b>{issue.title}</b><small><MapPin size={12} /> {issue.area} · {issue.location}</small></span></span><span className="status-pill status-resolution_submitted">Review needed</span><ArrowRight size={15} className="row-arrow" /></button>)}{!issues.some(issue => issue.status === 'resolution_submitted') && <p className="panel-empty">No repairs are waiting for review right now.</p>}</section>
    {liveMode && role === 'admin' && <AdminTools organizationId={organizationId} members={members} actorId={actorId} wards={wardNames} departments={departmentNames} onRefresh={onRefreshAdmin} onMessage={onMessage} />}
  </>
}

function AdminTools({ organizationId, members, actorId, wards: wardNames, departments: departmentNames, onRefresh, onMessage }: { organizationId: string; members: VillageMember[]; actorId: string; wards: string[]; departments: string[]; onRefresh: () => Promise<void>; onMessage: (message: string) => void }) {
  const [wardName, setWardName] = useState('')
  const [landmarks, setLandmarks] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const roleOptions: Role[] = ['resident', 'worker', 'supervisor', 'admin']

  async function addWard(event: FormEvent) {
    event.preventDefault()
    if (!wardName.trim() || busy) return
    setBusy(true); setError('')
    try { await saveVillageWard(organizationId, wardName.trim(), landmarks.trim()); await onRefresh(); setWardName(''); setLandmarks(''); onMessage('Village ward added') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Ward could not be saved.') }
    finally { setBusy(false) }
  }

  async function addDepartment(event: FormEvent) {
    event.preventDefault()
    if (!departmentName.trim() || busy) return
    setBusy(true); setError('')
    try { await saveVillageDepartment(organizationId, departmentName.trim()); await onRefresh(); setDepartmentName(''); onMessage('Department added') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Department could not be saved.') }
    finally { setBusy(false) }
  }

  async function changeRole(member: VillageMember, role: Role) {
    if (busy) return
    setBusy(true); setError('')
    try { await updateVillageMemberRole(organizationId, member.userId, role); await onRefresh(); onMessage(`Updated village role for ${member.displayName}`) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Member role could not be changed.') }
    finally { setBusy(false) }
  }

  async function toggleMember(member: VillageMember) {
    if (busy) return
    setBusy(true); setError('')
    try { await setVillageMemberActive(organizationId, member.userId, !member.active); await onRefresh(); onMessage(member.active ? 'Village access suspended' : 'Village access restored') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Village access could not be changed.') }
    finally { setBusy(false) }
  }

  return <section className="admin-tools"><div className="panel-header admin-tools-heading"><div><p className="eyebrow">VILLAGE SETUP AND ACCESS</p><h3>Administrator tools</h3></div><span className="readonly-tag">ADMIN ONLY</span></div>{error && <p className="form-error" role="alert">{error}</p>}
    <div className="admin-tools-grid"><section className="panel admin-tool-card"><div className="panel-header"><div><p className="eyebrow">AREAS</p><h3>Wards and landmarks</h3></div></div><div className="admin-chips">{wardNames.map(ward => <span className="admin-chip" key={ward}>{ward}</span>)}</div><form className="admin-add-form" onSubmit={event => { void addWard(event) }}><input required maxLength={100} value={wardName} onChange={event => setWardName(event.target.value)} placeholder="New ward or area name" /><input maxLength={500} value={landmarks} onChange={event => setLandmarks(event.target.value)} placeholder="Landmarks (optional)" /><button className="outline-button" disabled={busy || !wardName.trim()}><Plus size={14} /> Add ward</button></form></section>
      <section className="panel admin-tool-card"><div className="panel-header"><div><p className="eyebrow">RESPONSIBLE TEAMS</p><h3>Departments</h3></div></div><div className="admin-chips">{departmentNames.map(department => <span className="admin-chip" key={department}>{department}</span>)}</div><form className="admin-add-form department-form" onSubmit={event => { void addDepartment(event) }}><input required maxLength={100} value={departmentName} onChange={event => setDepartmentName(event.target.value)} placeholder="e.g. Water and drainage" /><button className="outline-button" disabled={busy || !departmentName.trim()}><Plus size={14} /> Add team</button></form></section></div>
    <section className="panel member-panel"><div className="panel-header"><div><p className="eyebrow">CURRENT VILLAGE ACCOUNTS</p><h3>Members and roles</h3></div><span className="results-count">{members.length} members</span></div><p className="admin-guidance">New accounts join with the village code as residents. You can assign worker or supervisor access after they join.</p><div className="admin-member-list">{members.map(member => <div className={`admin-member-row ${!member.active ? 'member-disabled' : ''}`} key={member.userId}><div className="avatar avatar-olive">{member.displayName.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}</div><span className="admin-member-name"><b>{member.displayName}{member.userId === actorId ? ' · you' : ''}</b><small>{member.active ? 'Active village member' : 'Access suspended'}</small></span><select aria-label={`Role for ${member.displayName}`} disabled={busy || member.userId === actorId || !member.active} value={member.role} onChange={event => { void changeRole(member, event.target.value as Role) }}>{roleOptions.map(role => <option key={role} value={role}>{roleTitle[role]}</option>)}</select><button className="member-access-button" disabled={busy || member.userId === actorId} onClick={() => { void toggleMember(member) }}>{member.active ? 'Suspend' : 'Restore'}</button></div>)}</div></section>
  </section>
}

function Settings({ language, setLanguage, onReset, t, liveMode }: { language: Language; setLanguage: (language: Language) => void; onReset: () => void; t: (key: string) => string; liveMode: boolean }) {
  return <><div className="page-heading"><div><p className="eyebrow">YOUR GRAM CLEAN EXPERIENCE</p><h1>{t('settings')}</h1><p>Manage your language preference and village account.</p></div></div><section className="panel settings-panel"><div className="setting-row"><div className="setting-icon"><Languages size={18} /></div><div className="setting-copy"><b>App language</b><small>Choose your preferred language.</small></div><select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="mr">मराठी · Marathi</option><option value="hi">हिन्दी · Hindi</option><option value="en">English</option></select></div><div className="setting-row"><div className="setting-icon"><ShieldCheck size={18} /></div><div className="setting-copy"><b>Village</b><small>Your reports are scoped to your active village membership.</small></div><span className="readonly-tag">{liveMode ? 'CONNECTED' : 'DEMO WORKSPACE'}</span></div>{!liveMode && <div className="setting-row"><div className="setting-icon"><Trash2 size={18} /></div><div className="setting-copy"><b>Reset sample data</b><small>Restore the original example reports in this browser.</small></div><button className="outline-button" onClick={onReset}>Reset demo data</button></div>}</section></>
}

function ReportModal({ onClose, onSubmit, t, liveMode, wards: wardOptions, wardIds, issues, organizationId, language }: { onClose: () => void; onSubmit: (issue: Issue, photo?: File) => Promise<void>; t: (key: string) => string; liveMode: boolean; wards: string[]; wardIds: Record<string, string>; issues: Issue[]; organizationId: string; language: Language }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [area, setArea] = useState(wardOptions[0] ?? '')
  const [location, setLocation] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [suggestion, setSuggestion] = useState<ReportSuggestion | null>(null)
  const [similarIssues, setSimilarIssues] = useState<SimilarVillageIssue[]>([])
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const [aiError, setAiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [duplicateChecked, setDuplicateChecked] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationMessage, setLocationMessage] = useState('')

  async function getGpsLocation() {
    setGpsLoading(true)
    setLocationMessage('')
    try {
      let position: { coords: { latitude: number; longitude: number } }
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.checkPermissions()
        if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') await Geolocation.requestPermissions()
        position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 })
      } else {
        if (!navigator.geolocation) throw new Error('Location is unavailable in this browser.')
        position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }))
      }
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      setLocationMessage('Location added. You can still edit the landmark text.')
    } catch (caught) {
      const error = caught as { code?: number; message?: string }
      setLocationMessage(error.code === 1 || error.message?.toLowerCase().includes('permission') ? 'Location permission was declined. You can enter a landmark instead.' : 'Could not get your location. You can enter a landmark instead.')
    } finally { setGpsLoading(false) }
  }

  async function checkForSimilarReports() {
    if (title.trim().length < 5 || description.trim().length < 10 || duplicateLoading) return
    setDuplicateLoading(true)
    setDuplicateChecked(false)
    try {
      if (liveMode) {
        const wardId = wardIds[area]
        if (!wardId) throw new Error('A ward is required to check for similar village reports.')
        setSimilarIssues(await findSimilarVillageIssues(organizationId, title.trim(), description.trim(), category, wardId))
      } else {
        const terms = `${title} ${description}`.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 4)
        const ranked = issues.map(issue => {
          const haystack = `${issue.title} ${issue.description}`.toLocaleLowerCase()
          const matches = new Set(terms.filter(term => haystack.includes(term))).size
          return { issue, matches }
        }).filter(({ issue, matches }) => matches >= 2 || (matches >= 1 && issue.category === category && issue.area === area))
          .sort((a, b) => b.matches - a.matches).slice(0, 3)
        setSimilarIssues(ranked.map(({ issue }) => ({ id: issue.id, category: issue.category, status: issue.status, area: issue.area, createdAt: issue.createdAt })))
      }
      setDuplicateChecked(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Similar reports could not be checked.')
    } finally { setDuplicateLoading(false) }
  }

  async function requestSuggestion() {
    if (!organizationId || description.trim().length < 5 || aiLoading) return
    setAiLoading(true)
    setAiError('')
    try { setSuggestion(await assistReport(organizationId, description.trim(), language, photo ?? undefined)) }
    catch (caught) { setAiError(caught instanceof Error ? caught.message : 'AI suggestions are unavailable. You can continue without AI.') }
    finally { setAiLoading(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (title.trim().length < 5 || description.trim().length < 10 || !location.trim()) { setError('Add a short title, a few details and a location to continue.'); return }
    setSubmitting(true)
    setError('')
    try { await onSubmit({ id: `GC-${Math.floor(249 + Math.random() * 750)}`, idempotencyKey, title: title.trim(), description: description.trim(), category, priority: category.includes('Drainage') || category.includes('Water') ? 'high' : 'normal', status: 'new', area, location: location.trim(), latitude: coordinates?.latitude, longitude: coordinates?.longitude, reporter: 'Anita Patil', department: '', worker: '', createdAt: 'Just now', points: 0, photoName: photo?.name }, photo ?? undefined) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'We could not submit this report.') }
    finally { setSubmitting(false) }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-heading"><div className="modal-header"><div><p className="eyebrow">NEW VILLAGE REPORT</p><h2 id="report-heading">{t('report')}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div><p className="modal-intro">Share what you noticed. Your neighbours and local team can follow progress.</p><form onSubmit={event => { void submit(event) }}>
    <label className="field-label">{t('title')}<input autoFocus required minLength={5} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Broken streetlight near the temple" /></label>
    <label className="field-label">{t('description')}<textarea required rows={3} minLength={10} maxLength={700} value={description} onChange={event => { setDescription(event.target.value); setSuggestion(null) }} placeholder="What happened, and when did you notice it?" /></label>
    <div className="similar-check"><button type="button" className="outline-button" disabled={duplicateLoading || title.trim().length < 5 || description.trim().length < 10 || (liveMode && !area)} onClick={() => { setError(''); void checkForSimilarReports() }}>{duplicateLoading ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />} Check for similar reports</button><small>Uses report wording and ward to look for possible duplicates. You decide whether to continue.</small></div>
    {duplicateChecked && <div className="similar-results" role="status"><b>{similarIssues.length ? 'Possible matches in this village' : 'No similar reports found'}</b>{similarIssues.length ? <ul>{similarIssues.map(item => <li key={item.id}><span>{item.category} · {statusLabel(item.status)}</span><small>{item.area} · {item.createdAt} · GC-{item.id.slice(0, 6).toUpperCase()}</small></li>)}</ul> : <small>You can submit your report. This check may not find every related issue.</small>}</div>}
    {liveMode && <div className="ai-assistance"><button type="button" className="ai-suggest-button" disabled={aiLoading || description.trim().length < 5} onClick={() => { void requestSuggestion() }}>{aiLoading ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />} Help me write this</button><small>When you ask, your description and an attached photo may be sent to Gemini. Your account name and GPS coordinates are not included; remove personal details from the text or photo first.</small></div>}
    {aiError && <p className="form-error" role="alert">{aiError}</p>}
    {suggestion && <div className="suggestion-card"><div><Sparkles size={14} /><b>AI suggestion · please review</b></div><p>{suggestion.improvedText}</p><small>{suggestion.category} · {suggestion.explanation}</small>{suggestion.imageSkipped && <small className="image-skipped">Image too large for AI review; the text was used.</small>}<button type="button" onClick={() => { setDescription(suggestion.improvedText); setCategory(suggestion.category); setSuggestion(null) }}>Use suggestion</button></div>}
    <div className="field-row"><label className="field-label">{t('category')}<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="field-label">{t('ward')}<select value={area} onChange={event => setArea(event.target.value)}>{wardOptions.map(item => <option key={item}>{item}</option>)}</select></label></div>
    <div className="location-row"><label className="field-label">{t('location')}<span className="location-input"><MapPin size={16} /><input required minLength={2} maxLength={250} value={location} onChange={event => setLocation(event.target.value)} placeholder="Street, landmark or nearby home" /></span></label><button type="button" className="gps-button" disabled={gpsLoading} onClick={getGpsLocation}>{gpsLoading ? <LoaderCircle className="spin" size={14} /> : <MapPin size={14} />} Use GPS</button></div><small className="location-note">GPS is optional. Precise coordinates are saved with the report only if you choose to add them.</small>{locationMessage && <small className="location-message" role="status">{locationMessage}</small>}
    <label className="upload-zone"><input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={event => { setPhoto(event.target.files?.[0] ?? null); setSuggestion(null) }} /><span className="upload-icon"><Camera size={19} /></span><span><b>{photo?.name || t('photo')}</b><small>Optional · JPG, PNG or WebP · Max 10 MB</small></span><span className="upload-add">{photo ? <Check size={16} /> : <Plus size={16} />}</span></label><p className="demo-upload-note">{liveMode ? 'Photos upload to the village’s private issue storage.' : 'Photos are not uploaded in this demo.'}</p>
    {liveMode && wardOptions.length === 0 && <p className="form-error">A village administrator needs to add a ward before reports can be submitted.</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>{t('cancel')}</button><button type="submit" className="primary-button" disabled={submitting || (liveMode && wardOptions.length === 0)}>{submitting ? <LoaderCircle className="spin" size={15} /> : <Plus size={16} />} {t('submit')}</button></div></form></section></div>
}

function IssueModal({ issue, role, onClose, onUpdate, t, onToast, lookups, liveMode }: { issue: Issue; role: Role; onClose: () => void; onUpdate: (updates: Partial<Issue>, photo?: File) => Promise<void>; t: (key: string) => string; onToast: (value: string) => void; lookups?: WorkspaceLookups; liveMode: boolean }) {
  const workerOptions = lookups ? lookups.workers : workers.map(name => ({ id: name, displayName: name }))
  const departmentOptions = lookups ? lookups.departments : departments.map(name => ({ id: name, name }))
  const [assignee, setAssignee] = useState(issue.workerId || workerOptions[0]?.id || '')
  const [department, setDepartment] = useState(issue.departmentId || departmentOptions[0]?.id || '')
  const [note, setNote] = useState(issue.resolutionNote || '')
  const [completionPhoto, setCompletionPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  async function save(updates: Partial<Issue>, message: string, photo?: File) {
    if (saving) return
    setSaving(true)
    try { await onUpdate(updates, photo); onToast(message); onClose() }
    catch (error) { onToast(error instanceof Error ? error.message : 'This update could not be saved.') }
    finally { setSaving(false) }
  }
  const canAssign = role === 'supervisor' || role === 'admin'
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal issue-modal" role="dialog" aria-modal="true" aria-labelledby="issue-heading"><div className="modal-header"><div><p className="eyebrow">{issue.displayId ?? issue.id} <span>·</span> {issue.area}</p><h2 id="issue-heading">{issue.title}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div><div className="issue-modal-tags"><span className={`status-pill status-${issue.status}`}>{statusLabel(issue.status)}</span><span className={`priority-tag priority-text-${issue.priority}`}><i className={`priority-dot priority-${issue.priority}`} /> {priorityLabel(issue.priority)} priority</span><span className="category-tag">{issue.category}</span></div><p className="issue-description">{issue.description}</p><div className="issue-meta-grid"><div><small><MapPin size={13} /> LOCATION</small><b>{issue.location}</b></div><div><small><Users size={13} /> REPORTED BY</small><b>{issue.reporter}</b></div><div><small><Clock3 size={13} /> REPORTED</small><b>{issue.createdAt}</b></div><div><small><Building2 size={13} /> DEPARTMENT</small><b>{issue.department || 'Not assigned'}</b></div></div>{issue.photos?.length ? <div className="photo-evidence">{issue.photos.map((photo, index) => <a key={`${photo.kind}-${index}`} className="evidence-photo" href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={`${photo.kind === 'report' ? 'Report' : 'Completion'} evidence for ${issue.title}`} /><span>{photo.kind === 'report' ? 'Report photo' : 'Completion photo'}</span></a>)}</div> : null}{issue.photoName && <div className="attached-photo"><Camera size={15} /> {issue.photoName} <small>{liveMode ? 'private village photo' : 'local demo attachment'}</small></div>}{issue.worker && <div className="assigned-worker"><div className="avatar avatar-olive">{issue.worker.split(' ').map(name => name[0]).join('')}</div><span><b>{issue.worker}</b><small>Assigned field worker</small></span></div>}{issue.resolutionNote && <div className="resolution-note"><b>Worker update</b><p>{issue.resolutionNote}</p></div>}
    {canAssign && ['new', 'assigned', 'in_progress', 'reopened'].includes(issue.status) && <div className="workflow-box"><p className="eyebrow">WORK ASSIGNMENT</p><div className="field-row"><label className="field-label">Department<select value={department} onChange={event => setDepartment(event.target.value)}>{departmentOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label">Assign to<select value={assignee} onChange={event => setAssignee(event.target.value)}>{workerOptions.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label></div><button className="primary-button full-button" disabled={saving || !assignee || !department} onClick={() => { const selectedWorker = workerOptions.find(item => item.id === assignee); const selectedDepartment = departmentOptions.find(item => item.id === department); void save({ worker: selectedWorker?.displayName ?? assignee, workerId: selectedWorker?.id, department: selectedDepartment?.name ?? department, departmentId: selectedDepartment?.id, status: 'assigned' }, `Assigned to ${selectedWorker?.displayName ?? assignee}`) }}><ClipboardCheck size={16} /> {t('assign')}</button></div>}
    {role === 'worker' && (issue.workerId || issue.worker === 'Ramesh Jadhav') && issue.status !== 'verified' && <div className="workflow-box"><p className="eyebrow">UPDATE THIS TASK</p>{issue.status === 'assigned' || issue.status === 'reopened' ? <button className="primary-button full-button" disabled={saving} onClick={() => void save({ status: 'in_progress' }, 'Task marked in progress')}><Bike size={16} /> {t('start')}</button> : issue.status === 'in_progress' ? <><label className="field-label">What work did you complete?<textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Add a short update for your supervisor" /></label><label className="upload-zone completion-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setCompletionPhoto(event.target.files?.[0] ?? null)} /><span className="upload-icon"><Camera size={18} /></span><span><b>{completionPhoto?.name ?? 'Add completion photo'}</b><small>{liveMode ? 'Required · Private village storage' : 'Optional in the local demo'}</small></span><span className="upload-add">{completionPhoto ? <Check size={16} /> : <Plus size={16} />}</span></label><button className="primary-button full-button" disabled={saving} onClick={() => { if (!note.trim()) { onToast('Add a brief work update first'); return } if (liveMode && !completionPhoto) { onToast('Add a completion photo before sending this task for review'); return } void save({ status: 'resolution_submitted', resolutionNote: note.trim() }, 'Repair sent to your supervisor for review', completionPhoto ?? undefined) }}><ArrowRight size={16} /> {t('sendReview')}</button></> : null}</div>}
    {(role === 'supervisor' || role === 'admin') && issue.status === 'resolution_submitted' && <div className="workflow-box"><p className="eyebrow">SUPERVISOR REVIEW</p><p className="review-help">Check the worker’s note and confirm the repair is complete.</p><label className="field-label">Review note<textarea rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Optional note for the resident or worker" /></label><div className="review-actions"><button className="outline-button" disabled={saving} onClick={() => void save({ status: 'reopened', resolutionNote: note.trim() }, 'Task returned for more work')}>{t('reopen')}</button><button className="primary-button verify-button" disabled={saving} onClick={() => void save({ status: 'verified', resolutionNote: note.trim(), points: 2 }, liveMode ? 'Repair verified. Community credits were recorded.' : 'Repair marked verified · 2 demo points awarded')}><CheckCircle2 size={16} /> {t('verify')}</button></div></div>}
    {issue.status === 'verified' && <div className="verified-banner"><BadgeCheck size={18} /><span><b>Verified repair</b><small>{issue.points || 2} community points recorded{liveMode ? '' : ' in this demo'}</small></span></div>}
    <div className="modal-actions"><button className="outline-button" onClick={onClose}>{t('back')}</button></div>
  </section></div>
}

export default App
