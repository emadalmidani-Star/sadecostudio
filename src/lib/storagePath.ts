const SAFE_EXTENSION = /^[a-z0-9]{1,8}$/i;

export function safeStorageFilename(name: string, fallback = "upload.jpg") {
  const source = name.trim() || fallback;
  const dot = source.lastIndexOf(".");
  const rawBase = dot > 0 ? source.slice(0, dot) : source;
  const rawExt = dot > 0 ? source.slice(dot + 1) : fallback.split(".").pop() || "jpg";
  const base = rawBase
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._'!,*&$@=;:+?() -]+/gi, "-")
    .replace(/[\s-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80) || "upload";
  const ext = SAFE_EXTENSION.test(rawExt) ? rawExt.toLowerCase() : "jpg";
  return `${base}.${ext}`;
}

export function makeStoragePath(...parts: Array<string | number | null | undefined>) {
  const filename = safeStorageFilename(String(parts.pop() || "upload.jpg"));
  return [...parts.filter(Boolean).map(part => String(part).replace(/[^a-z0-9_-]+/gi, "-")), `${Date.now()}-${filename}`].join("/");
}