import { useAuth } from './useAuth'
import {
  getCurrentUserIdState,
  getCurrentUserPendingFetch,
  setCurrentUserPendingFetch,
} from './currentUserIdState'

export function useCurrentUser () {
  const { fetchSession } = useAuth()
  const currentUserId = getCurrentUserIdState()

  function setCurrentUserId (id: number | null) {
    currentUserId.value = id
  }

  async function ensureCurrentUser (): Promise<number | null> {
    if (currentUserId.value !== null) {
      return currentUserId.value
    }
    const existing = getCurrentUserPendingFetch()
    if (existing) {
      return existing
    }
    const pendingFetch = (async () => {
      try {
        // 認証状態とユーザー情報はサーバーが判定する（フロントで JWT を解析しない）
        const session = await fetchSession()
        currentUserId.value = session.user?.id ?? null
        return currentUserId.value
      } catch {
        currentUserId.value = null
        return null
      } finally {
        setCurrentUserPendingFetch(null)
      }
    })()
    setCurrentUserPendingFetch(pendingFetch)
    return pendingFetch
  }

  return {
    currentUserId: readonly(currentUserId),
    setCurrentUserId,
    ensureCurrentUser,
  }
}
