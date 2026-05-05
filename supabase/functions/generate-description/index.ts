// AI generation for project descriptions + highlights
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { name, type, location, area, client, keywords, tone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const system = `You are a senior copywriter for SADECO Decor LLC, a luxury construction & interior fit-out company. Write polished, client-ready content in a ${tone || "luxury"} tone. Be specific, confident, and elegant. Avoid clichés.`;

    const user = `Project: ${name}
Type: ${type}
Location: ${location || "N/A"}
Area: ${area ? area + " sqm" : "N/A"}
Client: ${client || "Confidential"}
Keywords: ${keywords || "—"}

Generate a professional project description (120-180 words) and 4 key highlights.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [{
          type: "function",
          function: {
            name: "write_project",
            description: "Return description + highlights",
            parameters: {
              type: "object",
              properties: {
                description: { type: "string" },
                highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
              },
              required: ["description", "highlights"],
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
    const parsed = args ? JSON.parse(args) : { description: "", highlights: [] };
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
