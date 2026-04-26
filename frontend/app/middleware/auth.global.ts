export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/org/')) {
    return
  }

  if (!import.meta.client) {
    return
  }

  const token = localStorage.getItem('id_token')?.trim() ?? ''
  if (!token) {
    return navigateTo({
      path: '/login',
      query: { next: to.fullPath },
    })
  }
})
