import { useApi } from './useApi'
import {
  clearCurrentUserId,
  getCurrentUserIdState,
  getCurrentUserPendingFetch,
  setCurrentUserPendingFetch,
} from './currentUserIdState'

type MeResponse = {
  id: number
}

export { clearCurrentUserId }

export function useCurrentUser () {
  const { api } = useApi()
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
        const me = await api<MeResponse>('/me')
        currentUserId.value = me.id
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
