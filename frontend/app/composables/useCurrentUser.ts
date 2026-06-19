import { useApi } from './useApi'

type MeResponse = {
  id: number
}

const currentUserId = ref<number | null>(null)
let pendingFetch: Promise<number | null> | null = null

export function useCurrentUser () {
  const { api } = useApi()

  function setCurrentUserId (id: number | null) {
    currentUserId.value = id
  }

  async function ensureCurrentUser (): Promise<number | null> {
    if (currentUserId.value !== null) {
      return currentUserId.value
    }
    if (pendingFetch) {
      return pendingFetch
    }

    pendingFetch = (async () => {
      try {
        const me = await api<MeResponse>('/me')
        currentUserId.value = me.id
        return currentUserId.value
      } catch {
        currentUserId.value = null
        return null
      } finally {
        pendingFetch = null
      }
    })()

    return pendingFetch
  }

  return {
    currentUserId: readonly(currentUserId),
    setCurrentUserId,
    ensureCurrentUser,
  }
}
