// Only allow redirects to paths inside PROMTP (blocks "//evil.com" style open redirects).
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
