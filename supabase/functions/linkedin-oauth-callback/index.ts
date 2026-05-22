import { createClient } from 'npm:@supabase/supabase-js@2'

const CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET')!
const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/linkedin-oauth-callback`

function html(body: string, ok: boolean) {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:32px;text-align:center">
      <h2>${ok ? '✓ LinkedIn connected' : '✗ LinkedIn connection failed'}</h2>
      <p>${body}</p>
      <p>You can close this window.</p>
      <script>
        try { window.opener && window.opener.postMessage({ type: 'linkedin-oauth', ok: ${ok} }, '*'); } catch(e){}
        setTimeout(() => window.close(), 1500);
      </script>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (err) return html(`LinkedIn returned: ${err}`, false)
  if (!code || !state) return html('Missing code or state.', false)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: stRow, error: stErr } = await admin
    .from('linkedin_oauth_states').select('user_id, created_at').eq('state', state).maybeSingle()
  if (stErr || !stRow) return html('Invalid or expired state.', false)
  await admin.from('linkedin_oauth_states').delete().eq('state', state)

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok) return html(`Token exchange failed: ${tokenJson.error_description || tokenJson.error || tokenRes.status}`, false)

  const accessToken = tokenJson.access_token as string
  const expiresIn = Number(tokenJson.expires_in || 0)
  const scope = tokenJson.scope as string | undefined

  const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const me = await meRes.json()
  if (!meRes.ok) return html(`Profile fetch failed: ${me.message || meRes.status}`, false)

  const { error: upErr } = await admin.from('linkedin_connections').upsert({
    user_id: stRow.user_id,
    linkedin_sub: me.sub,
    name: me.name ?? null,
    email: me.email ?? null,
    picture: me.picture ?? null,
    access_token: accessToken,
    expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scope: scope ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (upErr) return html(`Save failed: ${upErr.message}`, false)
  return html(`Welcome, ${me.name || me.email || 'LinkedIn member'}.`, true)
})
