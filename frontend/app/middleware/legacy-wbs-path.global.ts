export default defineNuxtRouteMiddleware((to) => {
  const match = to.path.match(/^(\/org\/[^/]+\/projects\/[^/]+)\/wbs\/?$/)
  if (!match) {
    return
  }
  return navigateTo({
    path: match[1],
    query: { ...to.query, view: 'table' },
  }, { replace: true })
})
