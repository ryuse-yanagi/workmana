/**
 * API が返すアバター URL（相対 `/storage/...` または絶対 URL）を、
 * ブラウザから読める URL に解決する。
 *
 * - ローカル: `apiBaseUrl` が `/api` のとき同一オリジンの `/storage`（Vite プロキシ）
 * - 本番: `apiBaseUrl` が絶対 URL のとき API オリジンの `/storage/...`
 */
export function resolveAvatarUrl (
  url: string | null | undefined,
  apiBaseUrl: string = '/api',
): string | null {
  if (!url) {
    return null
  }
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url
  }

  const storagePath = extractStoragePath(url)
  if (!storagePath) {
    return url
  }

  const base = apiBaseUrl.replace(/\/$/, '')
  if (!base || base.startsWith('/')) {
    return storagePath
  }

  try {
    return `${new URL(base).origin}${storagePath}`
  } catch {
    return storagePath
  }
}

function extractStoragePath (url: string): string | null {
  if (url.startsWith('/storage/')) {
    return url
  }
  if (url.startsWith('storage/')) {
    return `/${url}`
  }
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/storage/')) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    // not an absolute URL
  }
  return null
}
