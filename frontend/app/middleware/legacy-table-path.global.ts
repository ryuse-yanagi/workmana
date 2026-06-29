export default defineNuxtRouteMiddleware((to) => {
  // 旧パス `/org/.../workspaces/{id}/wbs` を table ビューへリダイレクト
  const match = to.path.match(/^(\/org\/[^/]+\/workspaces\/[^/]+)\/wbs\/?$/)
  if (!match) {
    return
  }
  return navigateTo({
    path: match[1],
    query: { ...to.query, view: 'table' },
  }, { replace: true })
})
