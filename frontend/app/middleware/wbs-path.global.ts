export default defineNuxtRouteMiddleware((to) => {
  // 旧パス `/org/.../workspaces/{id}/wbs` を WBS ビューへリダイレクト
  const pathMatch = to.path.match(/^(\/org\/[^/]+\/workspaces\/[^/]+)\/wbs\/?$/)
  if (pathMatch) {
    return navigateTo({
      path: pathMatch[1],
      query: { ...to.query, view: 'wbs' },
    }, { replace: true })
  }

  // 旧クエリ `?view=table`（および list/gantt）を canonical `?view=wbs` へ寄せる
  const view = to.query.view
  if (
    typeof view === 'string'
    && (view === 'table' || view === 'list' || view === 'gantt')
    && (
      String(to.name || '').includes('workspaces-id')
      || /\/org\/[^/]+\/workspaces\/[^/]+$/.test(to.path)
    )
  ) {
    return navigateTo({
      path: to.path,
      query: { ...to.query, view: 'wbs' },
      hash: to.hash,
    }, { replace: true })
  }
})
