import { useApi } from './useApi'
import { safeInternalPath } from '../utils/safeInternalPath'

export type AuthUser = {
  id: number
  email: string | null
  name: string | null
  avatar_url: string | null
  last_organization_id?: number | null
  organizations?: Array<{ id: number; name: string; slug: string; role?: string; icon_url?: string | null }>
}

export type AuthSession = {
  authenticated: boolean
  configured: boolean
  user: AuthUser | null
}

const SIGNED_OUT: AuthSession = { authenticated: false, configured: false, user: null }

/**
 * 認証はすべてバックエンド（HttpOnly セッション Cookie）に委ねる。
 * フロントエンドは JWT を保持もデコードもしない。
 */
export function useAuth () {
  const { api, apiBase } = useApi()

  /**
   * Cognito Hosted UI へのリダイレクトはバックエンドが組み立てる。
   * クライアント側に client_id や PKCE の情報を持たせない。
   */
  function loginUrl (next: string): string {
    const target = safeInternalPath(next, '/')
    return `${apiBase}/auth/login?next=${encodeURIComponent(target)}`
  }

  function startLogin (next: string): void {
    if (!import.meta.client) {
      return
    }
    window.location.href = loginUrl(next)
  }

  async function fetchSession (): Promise<AuthSession> {
    try {
      return await api<AuthSession>('/auth/session')
    } catch {
      return SIGNED_OUT
    }
  }

  async function logout (): Promise<void> {
    if (!import.meta.client) {
      return
    }
    let logoutUrl: string | null = null
    try {
      const res = await api<{ logout_url: string | null }>('/auth/logout', { method: 'POST' })
      logoutUrl = res.logout_url
    } catch {
      logoutUrl = null
    }
    // Cognito 側のセッションも終わらせるため、Hosted UI のログアウトを経由する
    window.location.href = logoutUrl || '/login'
  }

  return {
    loginUrl,
    startLogin,
    fetchSession,
    logout,
  }
}
