export const MAX_SOURCE_CHARACTERS = 100_000;
export function normalizeSource(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
}
export function sourceProblem(value: unknown): string | null {
  if (typeof value !== 'string' || (normalizeSource(value).match(/[\p{L}\p{N}]/gu) || []).length < 20) return 'Upload or paste readable source notes before generating (at least 20 letters or numbers). No paper has been generated.';
  if (normalizeSource(value).length > MAX_SOURCE_CHARACTERS) return 'Source notes exceed 100,000 characters. Split them into smaller documents; no text will be silently cut off.';
  return null;
}
export function sourceGrade(text: string): number | null {
  const match = text.match(/\b(?:grade|class|year)\s*[:\-]?\s*(1[0-2]|[1-9]|XII|XI|VIII|VII|VI|IV|IX|III|II|X|V|I)\b/i);
  if (!match) return null;
  const romans: Record<string,number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12 };
  return Number(match[1]) || romans[match[1].toUpperCase()] || null;
}
