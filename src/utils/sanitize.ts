/**
 * Safe HTML Sanitizer for Inspection Comment Narratives
 * Strips dangerous executable tags (<script>, <iframe>, <object>, <embed>)
 * and inline event handlers (onerror=, onload=, onclick=, etc.)
 * while preserving safe formatting tags (<b>, <i>, <p>, <ul>, <ol>, <li>, <a>, <br>, <strong>, <em>, <span>).
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let clean = html;

  // 1. Remove dangerous executable tags and contents
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 2. Remove inline event handlers (e.g. onerror="...", onclick='...')
  clean = clean.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");

  // 3. Neutralize javascript: pseudo-protocol in href or src
  clean = clean.replace(/(href|src)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, '$1="#"');

  return clean;
}
