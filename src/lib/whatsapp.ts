// WhatsApp helpers
export function cleanPhone(input: string | null | undefined): string {
  return (input || "").replace(/\D/g, "");
}

export function waLink(phone: string, message?: string) {
  const p = cleanPhone(phone);
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${p}${q}`;
}

/** Fill {{1}}, {{2}} positional vars, and {{name}} keyword vars */
export function renderTemplateBody(body: string, vars: Record<string, string>): string {
  if (!body) return "";
  let out = body;
  // {{name}} keys
  out = out.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  // {{1}}, {{2}}
  out = out.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => vars[n] ?? `{{${n}}}`);
  return out;
}

export function extractTemplateVars(body: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return Array.from(set);
}
