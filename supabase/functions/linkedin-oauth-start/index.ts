import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID')!
const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/linkedin-oauth-callback`
const SCOPES = 'openid profile email w_member_social'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''))
  if (cErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const userId = claims.claims.sub as string

  const state = crypto.randomUUID() + '.' + crypto.randomUUID()
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error: insErr } = await admin.from('linkedin_oauth_states').insert({ state, user_id: userId })
  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', SCOPES)

  return new Response(JSON.stringify({ url: url.toString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
