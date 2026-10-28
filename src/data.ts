import type { Activity, Issue } from './types'

export const seedIssues: Issue[] = [
  { id: 'GC-248', title: 'Garbage piling up near the bus stop', description: 'The community bin has been full since yesterday morning. Waste is spilling onto the footpath.', category: 'Garbage & sanitation', priority: 'high', status: 'in_progress', area: 'Ward 2', location: 'Main road · near the bus stop', reporter: 'Anita Patil', department: 'Sanitation', worker: 'Ramesh Jadhav', createdAt: 'Today, 9:24 AM', points: 0 },
  { id: 'GC-247', title: 'Streetlight not working', description: 'The light near the temple entrance does not turn on after sunset.', category: 'Streetlights', priority: 'normal', status: 'assigned', area: 'Ward 1', location: 'Hanuman temple entrance', reporter: 'Suresh More', department: 'Electrical', worker: 'Vijay Shinde', createdAt: 'Today, 8:10 AM', points: 0 },
  { id: 'GC-246', title: 'Water is collecting by the lane', description: 'A drain is blocked and water is collecting outside three homes.', category: 'Drainage', priority: 'urgent', status: 'resolution_submitted', area: 'Ward 3', location: 'School lane · house 18', reporter: 'Meena Pawar', department: 'Water & drainage', worker: 'Ramesh Jadhav', createdAt: 'Yesterday, 4:42 PM', points: 0, resolutionNote: 'Cleared the drain and flushed the channel. Please verify after the next rain.' },
  { id: 'GC-245', title: 'Pothole on the market road', description: 'A deep pothole has opened up near the weekly market. It is difficult for two-wheelers to pass.', category: 'Road damage', priority: 'high', status: 'new', area: 'Ward 2', location: 'Weekly market · east entrance', reporter: 'Kavita Deshmukh', department: 'Roads', worker: '', createdAt: 'Yesterday, 11:18 AM', points: 0 },
  { id: 'GC-244', title: 'Broken tap at the public toilet', description: 'Water runs continuously from the tap beside the women’s washroom.', category: 'Public toilets', priority: 'normal', status: 'verified', area: 'Ward 1', location: 'Community toilet · south side', reporter: 'Rahul Pawar', department: 'Water & drainage', worker: 'Vijay Shinde', createdAt: '22 Oct, 2:20 PM', points: 2, resolutionNote: 'Replaced the tap washer and checked for leaks.' },
]

export const recentActivity: Activity[] = [
  { id: 'GC-248', title: 'Garbage piling up near the bus stop', location: 'Ward 2 · Main road', status: 'in_progress', time: '12 min ago', priority: 'high' },
  { id: 'GC-247', title: 'Streetlight not working', location: 'Ward 1 · Temple entrance', status: 'assigned', time: '1 hr ago', priority: 'normal' },
  { id: 'GC-246', title: 'Water is collecting by the lane', location: 'Ward 3 · School lane', status: 'resolution_submitted', time: '3 hr ago', priority: 'urgent' },
]

export const categories = ['Garbage & sanitation', 'Drainage', 'Water supply', 'Road damage', 'Streetlights', 'Public toilets', 'Public facilities', 'Other maintenance']
export const wards = ['Ward 1', 'Ward 2', 'Ward 3']
export const departments = ['Sanitation', 'Water & drainage', 'Roads', 'Electrical', 'Public facilities']
export const workers = ['Ramesh Jadhav', 'Vijay Shinde', 'Asha Pawar', 'Prakash More']

export const leaderboard = [
  { name: 'Anita Patil', ward: 'Ward 2', points: 42, initials: 'AP', color: 'lilac' },
  { name: 'Rahul Pawar', ward: 'Ward 1', points: 36, initials: 'RP', color: 'peach' },
  { name: 'Meena Pawar', ward: 'Ward 3', points: 31, initials: 'MP', color: 'mint' },
  { name: 'Kavita Deshmukh', ward: 'Ward 2', points: 24, initials: 'KD', color: 'blue' },
]
