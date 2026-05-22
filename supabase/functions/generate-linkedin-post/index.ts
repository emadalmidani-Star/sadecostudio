import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { project, tone = 'professional', length = 'medium', hashtags = true, language = 'English' } = await req.json()
    if (!project?.name) {
      return new Response(JSON.stringify({ error: 'project is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const facts = [
      `Project: ${project.name}`,
      project.client_name && `Client: ${project.client_name}`,
      project.location && `Location: ${project.location}`,
      project.type && `Type: ${project.type}`,
      project.area_sqm && `Area: ${project.area_sqm} sqm`,
      project.status && `Status: ${project.status}`,
      project.phase && `Phase: ${project.phase}`,
      project.progress_pct != null && `Progress: ${project.progress_pct}%`,
      project.estimated_completion && `Est. completion: ${project.estimated_completion}`,
      project.description && `Description: ${project.description}`,
      Array.isArray(project.highlights) && project.highlights.length && `Highlights: ${project.highlights.join('; ')}`,
    ].filter(Boolean).join('\n')

    const sys = `You write LinkedIn posts for SADECO Decor LLC, an interior fit-out and decor company. Write a single ready-to-publish post in ${language}. Tone: ${tone}. Length: ${length} (short ~400 chars, medium ~800, long ~1200). Use short paragraphs and one or two tasteful emojis maximum. ${hashtags ? 'End with 4-6 relevant hashtags on one line.' : 'Do not include hashtags.'} Do not use markdown, headings, or quotes. Do not invent facts beyond what is provided.`

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Write the LinkedIn post for this project:\n\n${facts}` },
        ],
      }),
    })

    if (r.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (r.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits in Lovable AI settings.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!r.ok) {
      const t = await r.text()
      return new Response(JSON.stringify({ error: `AI gateway error: ${t}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const json = await r.json()
    const content = json.choices?.[0]?.message?.content?.trim() ?? ''
    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
