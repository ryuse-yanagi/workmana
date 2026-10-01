/**
 * API が返すアバター／アイコン URL を、ブラウザから読める URL に解決する。
 *
 * - ローカル public ディスク: 相対 `/storage/...`。`apiBaseUrl` が `/api` なら同一オリジン（Vite プロキシ）
 * - S3: `https://...` の絶対 URL はそのまま使う
 * - 本番で API が相対 `/storage/...` を返す場合: `apiBaseUrl` のオリジンへ解決
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
