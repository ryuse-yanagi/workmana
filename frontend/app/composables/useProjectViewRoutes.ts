export type ProjectViewKey = 'kanban' | 'wbs' | 'documents'

export type ProjectViewOption = {
  key: ProjectViewKey
  label: string
  to: string
}

export function projectViewFromRouteName (routeName: string | symbol | null | undefined): ProjectViewKey {
  const name = String(routeName || '')
  if (name.includes('wbs')) {
    return 'wbs'
  }
  if (name.includes('documents')) {
    return 'documents'
  }
  return 'kanban'
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
    { key: 'kanban', label: 'カンバン', to: basePath.value },
    { key: 'wbs', label: 'WBS', to: `${basePath.value}/wbs` },
    { key: 'documents', label: '共有資料', to: `${basePath.value}/documents` },
  ])

  const activeView = computed(() => projectViewFromRouteName(route.name))

  return {
    views,
    activeView,
    basePath,
  }
}
