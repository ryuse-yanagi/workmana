export default defineNuxtRouteMiddleware(async (to) => {
  const needsAuth = to.path.startsWith('/org/')
    || to.path === '/post-login'
    || to.path.startsWith('/organizations/')

  if (!needsAuth) {
    return
  }
  // セッション Cookie はブラウザにある。SSR では判定せず、クライアントで確認してから通す。
  if (!import.meta.client) {
    return
  }
  const { ensureCurrentUser } = useCurrentUser()
  let userId: number | null = null
  try {
    userId = await ensureCurrentUser()
  } catch {
    userId = null
  }
  if (userId !== null) {
    return
  }
  return navigateTo({
    path: '/login',
    query: { next: to.fullPath },
  })
})
