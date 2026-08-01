/**
 * 同一オリジン内の相対パスのみ許可する（オープンリダイレクト対策）。
 * `//evil.example` や `/\evil.example` は拒否する。
 */
export function safeInternalPath (value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value === '') {
    return fallback
  }
  if (!value.startsWith('/')) {
    return fallback
  }
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  return value
}
