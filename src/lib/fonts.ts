// Shared font registry for email + PDF designers.

export type FontOption = { id: string; label: string; stack: string; pdfName?: string };

const SYSTEM_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SYSTEM_SERIF = "Georgia,'Times New Roman',serif";

// Email-safe stacks. Always end with a web-safe fallback so Outlook desktop
// doesn't fall back to Times when the named family is missing.
export const EMAIL_FONTS: FontOption[] = [
  { id: "system-sans", label: "System Sans", stack: SYSTEM_SANS },
  { id: "system-serif", label: "System Serif", stack: SYSTEM_SERIF },
  { id: "arial", label: "Arial", stack: "Arial,Helvetica,sans-serif" },
  { id: "helvetica", label: "Helvetica", stack: "Helvetica,Arial,sans-serif" },
  { id: "georgia", label: "Georgia", stack: "Georgia,'Times New Roman',serif" },
  { id: "times", label: "Times", stack: "'Times New Roman',Times,serif" },
  { id: "courier", label: "Courier", stack: "'Courier New',Courier,monospace" },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma,Verdana,sans-serif" },
  { id: "verdana", label: "Verdana", stack: "Verdana,Geneva,sans-serif" },
  { id: "trebuchet", label: "Trebuchet MS", stack: "'Trebuchet MS',Tahoma,sans-serif" },
  { id: "palatino", label: "Palatino", stack: "'Palatino Linotype','Book Antiqua',Palatino,serif" },
  { id: "garamond", label: "Garamond", stack: "Garamond,Baskerville,'Times New Roman',serif" },
  { id: "inter", label: "Inter (web)", stack: "Inter,Helvetica,Arial,sans-serif" },
  { id: "playfair", label: "Playfair Display (web)", stack: "'Playfair Display',Georgia,serif" },
];

// Fonts that jsPDF knows about. "Montserrat" is registered via pdfFonts.ts.
export const PDF_FONTS: FontOption[] = [
  { id: "Montserrat", label: "Montserrat", stack: "Montserrat,sans-serif", pdfName: "Montserrat" },
  { id: "helvetica", label: "Helvetica", stack: "Helvetica,Arial,sans-serif", pdfName: "helvetica" },
  { id: "times", label: "Times", stack: "'Times New Roman',Times,serif", pdfName: "times" },
  { id: "courier", label: "Courier", stack: "'Courier New',Courier,monospace", pdfName: "courier" },
];

export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64];

export function emailStackFromId(id?: string | null, fallback?: string) {
  if (!id) return fallback || SYSTEM_SANS;
  return EMAIL_FONTS.find(f => f.id === id)?.stack || fallback || SYSTEM_SANS;
}

export function pdfNameFromId(id?: string | null, fallback = "Montserrat") {
  if (!id) return fallback;
  return PDF_FONTS.find(f => f.id === id)?.pdfName || fallback;
}
