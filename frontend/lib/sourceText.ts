export const MAX_SOURCE_CHARACTERS = 100_000;
export function normalizeSource(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
}
export function sourceProblem(value: unknown): string | null {
  if (typeof value !== 'string' || (normalizeSource(value).match(new RegExp('[\\p{L}\\p{N}]','gu')) || []).length < 20) return 'Upload or paste readable source notes before generating (at least 20 letters or numbers). No paper has been generated.';
  if (normalizeSource(value).length > MAX_SOURCE_CHARACTERS) return 'Source notes exceed 100,000 characters. Split them into smaller documents; no text will be silently cut off.';
  return null;
}
export async function readTextSource(file: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try { return normalizeSource(new TextDecoder(encoding, { fatal: true }).decode(bytes)); }
  catch { throw new Error('This TXT file could not be decoded. Save it as UTF-8 text, or paste the notes below.'); }
}
