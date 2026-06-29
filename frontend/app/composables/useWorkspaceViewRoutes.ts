export type WorkspaceViewKey = 'board' | 'table' | 'gantt'
/** プルダウンに載せないルート（資料など） */
export type WorkspaceRouteViewKey = WorkspaceViewKey | 'documents'
export type WorkspaceViewOption = {
  key: WorkspaceViewKey
  label: string
  to: string
}
/** 旧 URL の互換用 */
const LEGACY_TABLE_VIEW_QUERY_VALUES = new Set(['list', 'wbs'])
const LEGACY_BOARD_VIEW_QUERY_VALUES = new Set(['board'])
export function normalizeProjectViewQuery (view: unknown): WorkspaceViewKey | null {
  if (view === 'gantt') {
    return 'gantt'
  }
  if (view === 'table' || (typeof view === 'string' && LEGACY_TABLE_VIEW_QUERY_VALUES.has(view))) {
    return 'table'
  }
  if (view === 'board' || (typeof view === 'string' && LEGACY_BOARD_VIEW_QUERY_VALUES.has(view))) {
    return 'board'
  }
  return null
}
export function workspaceViewFromRoute (
  route: Pick<ReturnType<typeof useRoute>, 'name' | 'query'>,
): WorkspaceRouteViewKey {
  const name = String(route.name || '')
  if (name.includes('documents')) {
    return 'documents'
  }
  if (name === 'org-slug-workspaces-id' || name.includes('workspaces-id')) {
    const normalized = normalizeProjectViewQuery(route.query.view)
    if (normalized != null && normalized !== 'board') {
      return normalized
    }
  }
  if (name.includes('wbs')) {
    return 'table'
  }
  return 'board'
}
/** @deprecated workspaceViewFromRoute を使用 */
export function workspaceViewFromRouteName (routeName: string | symbol | null | undefined): WorkspaceRouteViewKey {
  if (String(routeName || '').includes('documents')) {
    return 'documents'
  }
  if (String(routeName || '').includes('wbs')) {
    return 'table'
  }
  return 'board'
}
export function useWorkspaceViewRoutes (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string>,
) {
  const route = useRoute()
  const slug = computed(() => toValue(orgSlug))
  const id = computed(() => toValue(workspaceId))
  const basePath = computed(() => `/org/${slug.value}/workspaces/${id.value}`)
  const views = computed((): WorkspaceViewOption[] => [
    { key: 'board', label: 'Board', to: basePath.value },
    { key: 'table', label: 'Table', to: `${basePath.value}?view=table` },
    { key: 'gantt', label: 'Gantt', to: `${basePath.value}?view=gantt` },
  ])
  const activeView = computed((): WorkspaceRouteViewKey => workspaceViewFromRoute(route))
  return {
    views,
    activeView,
    basePath,
  }
}
