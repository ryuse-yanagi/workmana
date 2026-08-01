export default defineNuxtRouteMiddleware(async (to) => {
  const needsAuth = to.path.startsWith('/org/')
    || to.path === '/post-login'
    || to.path.startsWith('/organizations/')

  if (!needsAuth) {
    return
  }
  // 認証は HttpOnly Cookie で行うためクライアントでしか判定できない
  if (!import.meta.client) {
    return
  }
  const { ensureCurrentUser } = useCurrentUser()
  const userId = await ensureCurrentUser()
  if (userId === null) {
    return navigateTo({
      path: '/login',
      query: { next: to.fullPath },
    })
  }
})
