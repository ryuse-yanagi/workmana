/** 他タブへ「いまのログインユーザー」を伝える。秘密情報は入れない。 */
export const AUTH_USER_STORAGE_KEY = 'tm:auth-user-id'

let authNavigationClaimed = false

/** ログアウトや再ログインへの遷移を、別の遷移で上書きしない。 */
export function claimAuthNavigation (): boolean {
  if (authNavigationClaimed) {
    return false
  }
  authNavigationClaimed = true
  return true
}

export function parseAuthUserId (value: string | null | undefined): number | null {
  if (value == null || value === '') {
    return null
  }
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function publishAuthUserId (userId: number | null): void {
  if (!import.meta.client) {
    return
  }
  try {
    const next = userId == null ? '' : String(userId)
    if (localStorage.getItem(AUTH_USER_STORAGE_KEY) === next) {
      return
    }
    localStorage.setItem(AUTH_USER_STORAGE_KEY, next)
  } catch {
    // ストレージが使えないブラウザでも、このタブのログアウト自体は続行する。
  }
}
