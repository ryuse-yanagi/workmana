/**
 * Cookie ベースの認証では CSRF 対策が必須になる。
 * Laravel が発行する XSRF-TOKEN Cookie を読み、X-XSRF-TOKEN ヘッダーとして送り返す。
 * このトークンはセッションそのものではないため、JavaScript から読めてよい。
 */
export function readXsrfToken (): string {
  if (!import.meta.client) {
    return ''
  }
  const matched = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  if (!matched?.[1]) {
    return ''
  }
  return decodeURIComponent(matched[1])
}

export async function ensureXsrfToken (
  apiBaseUrl: string,
  options: { force?: boolean } = {},
): Promise<string> {
  if (!import.meta.client) {
    return ''
  }
  if (!options.force) {
    const existing = readXsrfToken()
    if (existing) {
      return existing
    }
  }
  await $fetch(`${apiBaseUrl}/auth/csrf-cookie`, {
    credentials: 'include',
  })
  return readXsrfToken()
}
