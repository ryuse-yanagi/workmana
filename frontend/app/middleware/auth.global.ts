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
  let userId: number | null = null
  try {
    userId = await Promise.race([
      ensureCurrentUser(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 4_000)
      }),
    ])
  } catch {
    userId = null
  }
  if (userId !== null) {
    return
  }
  // /org は SSR 済みの一覧を優先。未ログインなら API が 401 になる
  if (to.path.startsWith('/org/')) {
    return
  }
  return navigateTo({
    path: '/login',
    query: { next: to.fullPath },
  })
})
