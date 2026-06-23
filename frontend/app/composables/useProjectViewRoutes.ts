export type ProjectViewKey = 'board' | 'table' | 'gantt'

/** プルダウンに載せないルート（共有資料など） */
export type ProjectRouteViewKey = ProjectViewKey | 'documents'

export type ProjectViewOption = {
  key: ProjectViewKey
  label: string
  to: string
}

/** 旧 URL の互換用 */
const LEGACY_TABLE_VIEW_QUERY_VALUES = new Set(['list', 'wbs'])
const LEGACY_BOARD_VIEW_QUERY_VALUES = new Set(['board'])

export function normalizeProjectViewQuery (view: unknown): ProjectViewKey | null {
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

export function projectViewFromRoute (
  route: Pick<ReturnType<typeof useRoute>, 'name' | 'query'>,
): ProjectRouteViewKey {
  const name = String(route.name || '')
  if (name.includes('documents')) {
    return 'documents'
  }
  if (name === 'org-slug-projects-id' || name.includes('projects-id')) {
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

/** @deprecated projectViewFromRoute を使用 */
export function projectViewFromRouteName (routeName: string | symbol | null | undefined): ProjectRouteViewKey {
  if (String(routeName || '').includes('documents')) {
    return 'documents'
  }
  if (String(routeName || '').includes('wbs')) {
    return 'table'
  }
  return 'board'
}

export function useProjectViewRoutes (
  orgSlug: MaybeRefOrGetter<string>,
  projectId: MaybeRefOrGetter<string>,
) {
  const route = useRoute()

  const slug = computed(() => toValue(orgSlug))
  const id = computed(() => toValue(projectId))

  const basePath = computed(() => `/org/${slug.value}/projects/${id.value}`)

  const views = computed((): ProjectViewOption[] => [
    { key: 'board', label: 'Board', to: basePath.value },
    { key: 'table', label: 'Table', to: `${basePath.value}?view=table` },
    { key: 'gantt', label: 'Gantt', to: `${basePath.value}?view=gantt` },
  ])

  const activeView = computed((): ProjectRouteViewKey => projectViewFromRoute(route))

  return {
    views,
    activeView,
    basePath,
  }
}
