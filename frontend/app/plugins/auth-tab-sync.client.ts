import { AUTH_USER_STORAGE_KEY, claimAuthNavigation, parseAuthUserId, publishAuthUserId } from '../composables/auth/authTabSync'

/**
 * 別タブでログアウト、または別ユーザーのログインが起きたら、
 * このタブの古い画面のまま操作させずログイン画面へ戻す。
 */
export default defineNuxtPlugin(() => {
  const { fetchSession, session } = useAuth()
  let checkInFlight = false

  function leaveForReauth () {
    const url = new URL(window.location.href)
    if (url.pathname === '/login' && url.searchParams.get('reauth') === '1') {
      return
    }
    if (!claimAuthNavigation()) {
      return
    }
    window.location.assign('/login?reauth=1')
  }

  watch(() => session.value?.user?.id ?? null, (id) => {
    if (id == null) {
      return
    }
    publishAuthUserId(id)
  }, { immediate: true })

  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_USER_STORAGE_KEY) {
      return
    }
    const localId = session.value?.user?.id ?? null
    const remoteId = parseAuthUserId(event.newValue)
    if (localId == null || localId === remoteId) {
      return
    }
    leaveForReauth()
  })

  async function confirmSessionStillMatches () {
    if (checkInFlight || document.visibilityState === 'hidden') {
      return
    }
    const localId = session.value?.user?.id ?? null
    if (localId == null) {
      return
    }
    checkInFlight = true
    try {
      const next = await fetchSession({ force: true })
      if ((next.user?.id ?? null) !== localId) {
        leaveForReauth()
      }
    } finally {
      checkInFlight = false
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void confirmSessionStillMatches()
    }
  })
  window.addEventListener('focus', () => {
    void confirmSessionStillMatches()
  })
})
