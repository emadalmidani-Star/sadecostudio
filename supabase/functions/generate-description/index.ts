// AI generation for project descriptions + highlights
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_GUIDE: Record<string, string> = {
  "fit-out": "Emphasise bespoke joinery, premium finishes, MEP coordination, programme control, and alignment with the client's brand identity.",
  "residential": "Emphasise livability, materiality, lighting design, custom millwork, and a calm, considered atmosphere tailored to the homeowner.",
  "commercial": "Emphasise brand expression, employee experience, durability, acoustics, and operational efficiency across high-traffic zones.",
  "hospitality": "Emphasise guest journey, ambience, signature moments, durable luxury materials, and seamless back-of-house integration.",
  "retail": "Emphasise storytelling, product visibility, lighting hierarchy, customer flow, and a flagship-level brand impression.",
  "f&b": "Emphasise sensory atmosphere, kitchen-to-floor flow, durable yet refined materials, and a memorable signature design moment.",
  "office": "Emphasise collaboration zones, focus areas, biophilia, premium meeting environments, and a brand-led identity.",
  "construction": "Emphasise structural execution, programme control, safety, quality benchmarks, and the engineered backbone of the build.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { name, type, location, area, client, keywords, tone, status, company } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const typeKey = String(type || "").toLowerCase().trim();
    const typeHint = TYPE_GUIDE[typeKey] || "Emphasise craftsmanship, materiality, and a polished client outcome.";
    const companyName = company?.name || "SADECO Decor LLC";
    const companyAbout = company?.about ? `\nAbout the company: ${company.about}` : "";
    const services = Array.isArray(company?.services) && company.services.length
      ? `\nCore services offered: ${company.services.join(", ")}.` : "";

    const system = `You are the head of brand and editorial copy for ${companyName}, a luxury construction and interior fit-out company in the UAE. Your writing sounds like a premium architecture and design publication (Wallpaper*, Dezeen, AD Middle East): confident, specific, sensory, and grounded in real construction and design vocabulary.

Brand voice rules:
- Tone: ${tone || "luxury, understated, authoritative"}.
- Use precise design and construction language (joinery, MEP coordination, millwork, fluted oak, book-matched stone, integrated lighting, acoustic treatment, programme, snagging, handover).
- Reference materials, finishes, and atmosphere — not generic adjectives like "amazing" or "beautiful".
- Avoid clichés ("state-of-the-art", "one-stop shop", "leading provider"), marketing fluff, hashtags, and emojis.
- Never invent client names, awards, dimensions, or budgets that were not provided. If a fact is missing, write around it gracefully.
- Write in third person. Vary sentence length and rhythm.
- British English spelling.${companyAbout}${services}

Type-specific guidance: ${typeHint}`;

    const user = `Write editorial copy for the following project:

Project name: ${name}
Project type: ${type}
Location: ${location || "Not specified"}
Built-up area: ${area ? area + " sqm" : "Not specified"}
Client: ${client || "Confidential"}
Status: ${status || "Not specified"}
Keywords / brief notes from the team: ${keywords || "(none provided)"}

Deliver:
1. A short headline (max 10 words) that captures the project's design idea — not just the name.
2. A polished description, 140-180 words, in 2 short paragraphs. Open with the design intent, then move into materiality, spatial experience, and the delivery story. Weave in any provided keywords naturally. Do not restate the project name in the first three words.
3. Exactly 4 key highlights. Each is a single sentence (max 18 words), specific and concrete — reference materials, scope, performance, or experience. Avoid starting all four with the same word.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [{
          type: "function",
          function: {
            name: "write_project",
            description: "Return editorial copy for a luxury fit-out project.",
            parameters: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Short editorial headline, max 10 words." },
                description: { type: "string", description: "140-180 words, two short paragraphs." },
                highlights: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                  maxItems: 4,
                  description: "Exactly 4 specific, concrete highlights.",
                },
              },
              required: ["headline", "description", "highlights"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "write_project" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { headline: "", description: "", highlights: [] };
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
