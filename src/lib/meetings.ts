export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fnUrl(name: string) {
  return `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${name}`;
}

export function randomToken(len = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
