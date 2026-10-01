import { useApi } from '../shared/useApi'
import { allowUnloadWithoutUnsavedPrompt, discardUnsavedChangesForLogout } from '../shared/useUnsavedChangesGuard'
import { claimAuthNavigation, publishAuthUserId } from './authTabSync'
import { getCurrentUserIdState } from './currentUserIdState'
import { safeInternalPath } from '../../utils/auth/safeInternalPath'

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

export const SIGNED_OUT: AuthSession = { authenticated: false, configured: false, user: null }

function isMembershipRole (role: string | null | undefined): role is 'admin' | 'member' {
  return role === 'admin' || role === 'member'
}

/** 応答に role が無い組織は、既に分かっている権限を残す。明示された admin / member はそのまま使う。 */
function mergeOrganizationRoles (
  previous: AuthUser['organizations'],
  next: NonNullable<AuthUser['organizations']>,
): NonNullable<AuthUser['organizations']> {
  if (!previous?.length) {
    return next
  }
  return next.map((org) => {
    if (isMembershipRole(org.role)) {
      return org
    }
    const prior = previous.find(item => item.id === org.id || item.slug === org.slug)
    if (prior && isMembershipRole(prior.role)) {
      return { ...org, role: prior.role }
    }
    return org
  })
}

function withPreservedOrganizationRoles (previous: AuthSession | null, next: AuthSession): AuthSession {
  if (!next.user?.organizations || !previous?.user?.organizations) {
    return next
  }
  return {
    ...next,
    user: {
      ...next.user,
      organizations: mergeOrganizationRoles(previous.user.organizations, next.user.organizations),
    },
  }
}

const AUTH_SESSION_STATE_KEY = 'auth.session'
const AUTH_SESSION_PENDING_KEY = '_authSessionPending'

/** クライアントで /auth/session を実測したあとだけ、未ログインキャッシュを信用する */
let clientSessionVerified = false
/** 進行中の取得より新しい取得が始まったら、古い応答ではセッションを上書きしない */
let sessionFetchGeneration = 0

type AuthNuxtApp = {
  [AUTH_SESSION_PENDING_KEY]?: Promise<AuthSession>
}

function isHttpUrl (value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function syncCurrentUserId (session: AuthSession | null): void {
  if (!import.meta.client) {
    return
  }
  getCurrentUserIdState().value = session?.user?.id ?? null
}

/**
 * 認証はすべてバックエンド（HttpOnly セッション Cookie）に委ねる。
 * フロントエンドは JWT を保持もデコードもしない。
 */
export function useAuth () {
  const { api, apiBase } = useApi()
  const session = useState<AuthSession | null>(AUTH_SESSION_STATE_KEY, () => null)

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

  function canUseCachedSession (force: boolean): boolean {
    if (force || session.value == null) {
      return false
    }
    if (import.meta.server || clientSessionVerified || session.value.user) {
      return true
    }
    return false
  }

  async function fetchSession (options?: { force?: boolean; timeout?: number }): Promise<AuthSession> {
    const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & AuthNuxtApp
    const force = Boolean(options?.force)
    const pending = nuxtApp[AUTH_SESSION_PENDING_KEY]
    if (pending && !force) {
      return pending
    }
    if (!force && canUseCachedSession(false)) {
      syncCurrentUserId(session.value)
      return session.value as AuthSession
    }

    const generation = ++sessionFetchGeneration
    const request = (async () => {
      try {
        const next = await api<AuthSession>('/auth/session', {
          ...(typeof options?.timeout === 'number' ? { timeout: options.timeout } : {}),
        })
        if (generation !== sessionFetchGeneration) {
          return session.value ?? next
        }
        const stored = withPreservedOrganizationRoles(session.value, next)
        session.value = stored
        syncCurrentUserId(stored)
        return stored
      } catch {
        if (session.value) {
          return session.value
        }
        if (generation !== sessionFetchGeneration) {
          return session.value ?? { ...SIGNED_OUT }
        }
        session.value = { ...SIGNED_OUT }
        syncCurrentUserId(session.value)
        return session.value
      } finally {
        if (generation === sessionFetchGeneration) {
          if (import.meta.client) {
            clientSessionVerified = true
          }
          if (nuxtApp[AUTH_SESSION_PENDING_KEY] === request) {
            nuxtApp[AUTH_SESSION_PENDING_KEY] = undefined
          }
        }
      }
    })()
    nuxtApp[AUTH_SESSION_PENDING_KEY] = request
    return request
  }

  function patchSessionUser (partial: Partial<AuthUser>): void {
    const current = session.value
    if (!current?.user) {
      return
    }
    const organizations = partial.organizations
      ? mergeOrganizationRoles(current.user.organizations, partial.organizations)
      : undefined
    session.value = {
      ...current,
      user: {
        ...current.user,
        ...partial,
        ...(organizations ? { organizations } : {}),
      },
    }
  }

  function clearSession (): void {
    session.value = { ...SIGNED_OUT }
    syncCurrentUserId(session.value)
    const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & AuthNuxtApp
    nuxtApp[AUTH_SESSION_PENDING_KEY] = undefined
    if (import.meta.client) {
      clientSessionVerified = true
    }
  }

  async function logout (): Promise<void> {
    if (!import.meta.client) {
      return
    }
    // 失敗時はセッションを消さず、呼び出し側が画面に留めてエラーを出す。
    // セッションを切る前に破棄する。切ったあとでは WBS の編集前への戻しが届かない。
    await discardUnsavedChangesForLogout()
    const res = await api<{ logout_url?: string | null }>('/auth/logout', { method: 'POST' })
    // 未保存の beforeunload より先に確認を外す。編集は破棄済みで、ページ遷移で捨てる。
    allowUnloadWithoutUnsavedPrompt()
    let clearCaches: (() => void) | null = null
    try {
      const { clearSessionScopedCaches } = await import('./useSessionScopedCaches')
      clearCaches = clearSessionScopedCaches
    } catch {
      // キャッシュは次の読み込みで消える。
    }
    publishAuthUserId(null)
    // 遷移が実際に始まるまでセッション表示は残す。先に消すと、この画面が空のユーザーのまま残る。
    window.addEventListener('pagehide', () => {
      clearCaches?.()
      clearSession()
    }, { once: true })
    const logoutUrl = typeof res.logout_url === 'string' ? res.logout_url : ''
    // 成功時だけ Cognito のログアウトを経由する。URL が無い環境はログイン画面へ。
    claimAuthNavigation()
    window.location.assign(isHttpUrl(logoutUrl) ? logoutUrl : '/login')
  }

  return {
    session: readonly(session),
    loginUrl,
    startLogin,
    fetchSession,
    patchSessionUser,
    clearSession,
    logout,
  }
}
