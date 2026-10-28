import { withSupabase } from 'npm:@supabase/server@1'

const categories = [
  'Garbage & sanitation', 'Drainage', 'Water supply', 'Road damage',
  'Streetlights', 'Public toilets', 'Public facilities', 'Other maintenance',
] as const

type RequestBody = {
  organizationId: string
  text: string
  language: 'mr' | 'hi' | 'en'
  image?: { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
}

const maxBodyBytes = 2_200_000
const maxImageBase64Chars = 1_850_000
const languageNames = { mr: 'Marathi', hi: 'Hindi', en: 'English' }
const responseSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: categories },
    improvedText: { type: 'string' },
    explanation: { type: 'string' },
  },
  required: ['category', 'improvedText', 'explanation'],
}

function corsHeaders(origin: string | null) {
  const allowed = Deno.env.get('GRAM_CLEAN_ALLOWED_ORIGIN')
  return {
    'Access-Control-Allow-Origin': allowed ? (origin === allowed ? allowed : 'null') : '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) })
}

function redactCommonContactDetails(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[phone number removed]')
}

const userHandler = withSupabase({ auth: 'user' }, async (request, context) => {
  const origin = request.headers.get('origin')
  if (request.method !== 'POST') return json({ error: 'POST requests only.' }, 405, origin)

  const allowedOrigin = Deno.env.get('GRAM_CLEAN_ALLOWED_ORIGIN')
  if (allowedOrigin && origin !== allowedOrigin) return json({ error: 'This origin is not allowed.' }, 403, origin)
  if (Number(request.headers.get('content-length') ?? '0') > maxBodyBytes) return json({ error: 'The request is too large.' }, 413, origin)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'AI suggestions are not configured yet.' }, 503, origin)

  let body: RequestBody
  try { body = await request.json() as RequestBody }
  catch { return json({ error: 'The request body must be valid JSON.' }, 400, origin) }

  if (!body || typeof body.organizationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.organizationId)) return json({ error: 'Choose a valid village workspace.' }, 400, origin)
  if (typeof body.text !== 'string' || body.text.trim().length < 5 || body.text.length > 700) return json({ error: 'Describe the issue in 5 to 700 characters.' }, 400, origin)
  if (!['mr', 'hi', 'en'].includes(body.language)) return json({ error: 'Choose Marathi, Hindi or English.' }, 400, origin)
  if (body.image && (!['image/jpeg', 'image/png', 'image/webp'].includes(body.image.mimeType) || typeof body.image.data !== 'string' || body.image.data.length > maxImageBase64Chars || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.image.data))) {
    return json({ error: 'Choose a JPG, PNG or WebP image under 1.3 MB for an AI suggestion.' }, 400, origin)
  }

  const userId = context.userClaims?.sub
  if (!userId) return json({ error: 'Sign in to use report suggestions.' }, 401, origin)
  const { data: membership, error: membershipError } = await context.supabase
    .from('memberships').select('organization_id').eq('organization_id', body.organizationId)
    .eq('user_id', userId).eq('active', true).maybeSingle()
  if (membershipError || !membership) return json({ error: 'Join this village before requesting a suggestion.' }, 403, origin)

  const { data: allowed, error: limitError } = await context.supabase.rpc('consume_ai_request', { p_organization_id: body.organizationId })
  if (limitError) return json({ error: 'AI suggestions are temporarily unavailable.' }, 503, origin)
  if (!allowed) return json({ error: 'Daily suggestion limit reached. You can still submit your report without AI.' }, 429, origin)

  const safeText = redactCommonContactDetails(body.text.trim())
  const parts: Array<Record<string, unknown>> = [{
    text: `Help a village resident write a clear maintenance report. Use ${languageNames[body.language]} for improvedText. Classify it as exactly one allowed category. Preserve only facts in the resident's description; do not invent a cause, urgency, time, repair or location. Keep it concise, respectful and easy to understand. Never make a decision about priority, assignment, verification or rewards. Return an explanation of the category and any wording changes. Do not repeat personal contact details.\nAllowed categories: ${categories.join(', ')}\nResident description: ${safeText}`,
  }]
  if (body.image) parts.push({ inline_data: { mime_type: body.image.mimeType, data: body.image.data } })

  let apiResponse: Response
  try {
    apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: responseSchema } } },
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return json({ error: 'The suggestion service did not respond. You can submit your report without AI.' }, 503, origin)
  }
  if (!apiResponse.ok) {
    const status = apiResponse.status === 429 ? 429 : 503
    return json({ error: status === 429 ? 'The suggestion service is busy. Try again shortly.' : 'The suggestion service is unavailable. You can submit your report without AI.' }, status, origin)
  }

  try {
    const result = await apiResponse.json()
    const output = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    const suggestion = JSON.parse(output)
    if (!categories.includes(suggestion.category) || typeof suggestion.improvedText !== 'string' || suggestion.improvedText.length < 5 || suggestion.improvedText.length > 700 || typeof suggestion.explanation !== 'string' || suggestion.explanation.length > 300) {
      return json({ error: 'The suggestion was incomplete. Try again or continue without AI.' }, 502, origin)
    }
    return json({ category: suggestion.category, improvedText: suggestion.improvedText, explanation: suggestion.explanation }, 200, origin)
  } catch {
    return json({ error: 'The suggestion could not be read. You can continue without AI.' }, 502, origin)
  }
})

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  const response = await userHandler.fetch(request)
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
})
