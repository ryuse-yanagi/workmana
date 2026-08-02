export type WorkspaceViewKey = 'board' | 'wbs'
/** プルダウンに載せないルート（資料など） */
export type WorkspaceRouteViewKey = WorkspaceViewKey | 'documents'
export type WorkspaceViewOption = {
  key: WorkspaceViewKey
  label: string
  to: string
}
/** 旧 URL の互換用。正規値は wbs */
const LEGACY_WBS_VIEW_QUERY_VALUES = new Set(['list', 'table', 'gantt'])
const LEGACY_BOARD_VIEW_QUERY_VALUES = new Set(['board'])
export function normalizeProjectViewQuery (view: unknown): WorkspaceViewKey | null {
  if (view === 'wbs' || (typeof view === 'string' && LEGACY_WBS_VIEW_QUERY_VALUES.has(view))) {
    return 'wbs'
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
  return 'board'
}
/** @deprecated workspaceViewFromRoute を使用 */
export function workspaceViewFromRouteName (routeName: string | symbol | null | undefined): WorkspaceRouteViewKey {
  if (String(routeName || '').includes('documents')) {
    return 'documents'
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
    { key: 'board', label: 'ボード', to: basePath.value },
    { key: 'wbs', label: 'WBS', to: `${basePath.value}?view=wbs` },
  ])
  const activeView = computed((): WorkspaceRouteViewKey => workspaceViewFromRoute(route))
  return {
    views,
    activeView,
    basePath,
  }
}
