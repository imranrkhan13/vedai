// Strip credentials from connection URLs before anything is logged.
export function redactSecrets(input: unknown): string {
  const text = input instanceof Error ? `${input.name}: ${input.message}` : String(input);
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@'"]*@/gi, '$1***@');
}
