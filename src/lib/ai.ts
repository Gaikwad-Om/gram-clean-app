import { categories } from '../data'
import { supabase } from './supabase'

export type ReportSuggestion = { category: string; improvedText: string; explanation: string; imageSkipped: boolean }

async function toBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const step = 0x8000
  for (let offset = 0; offset < bytes.length; offset += step) binary += String.fromCharCode(...bytes.subarray(offset, offset + step))
  return btoa(binary)
}

export async function assistReport(organizationId: string, text: string, language: 'mr' | 'hi' | 'en', photo?: File): Promise<ReportSuggestion> {
  if (!supabase) throw new Error('Connect the village workspace before using AI suggestions.')
  const includeImage = Boolean(photo && photo.size <= 1_300_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(photo.type))
  const image = includeImage && photo ? { mimeType: photo.type, data: await toBase64(photo) } : undefined
  const { data, error } = await supabase.functions.invoke('report-assistant', {
    body: { organizationId, text, language, ...(image ? { image } : {}) },
  })
  if (error) throw new Error(error.message || 'AI suggestions are unavailable.')
  if (!data || !categories.includes(data.category) || typeof data.improvedText !== 'string' || typeof data.explanation !== 'string') {
    throw new Error('The suggestion service returned an invalid response. Continue without AI.')
  }
  return { category: data.category, improvedText: data.improvedText, explanation: data.explanation, imageSkipped: Boolean(photo && !includeImage) }
}
