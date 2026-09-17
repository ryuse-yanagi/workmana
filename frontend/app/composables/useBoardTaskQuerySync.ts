import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'

/**
 * ボードの ?task= クエリとタスク詳細モーダルの同期。
 */
export function useBoardTaskQuerySync (options: {
  route: ReturnType<typeof useRoute>
  router: ReturnType<typeof useRouter>
  slug: Ref<string> | ComputedRef<string>
  pageReady: Ref<boolean>
  detailTaskId: Ref<number | null>
  editingTaskId: Ref<number | null>
  suppressTaskCardClick: Ref<boolean>
  closeCardMenu: () => void
}) {
  const {
    route,
    router,
    slug,
    pageReady,
    detailTaskId,
    editingTaskId,
    suppressTaskCardClick,
    closeCardMenu,
  } = options

  function parseTaskQueryId (): number | null {
    const raw = route.query.task
    const value = Array.isArray(raw) ? raw[0] : raw
    if (typeof value !== 'string' || value.trim() === '') {
      return null
    }
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null
    }
    return parsed
  }

  function syncTaskQueryParam (taskId: number) {
    if (!import.meta.client) return
    const current = parseTaskQueryId()
    if (current === taskId) return
    void router.replace({
      query: {
        ...route.query,
        task: String(taskId),
      },
    })
  }

  function clearTaskQueryParam () {
    if (!import.meta.client) return
    if (parseTaskQueryId() === null) return
    const nextQuery = { ...route.query }
    delete nextQuery.task
    void router.replace({ query: nextQuery })
  }

  function applyTaskQueryFromRoute () {
    if (!pageReady.value) return
    const raw = route.query.task
    if (raw != null && raw !== '') {
      const taskId = parseTaskQueryId()
      if (taskId === null) {
        void navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
        return
      }
      if (detailTaskId.value !== taskId) {
        detailTaskId.value = taskId
      }
      return
    }
  }

  function openTaskDetailById (taskId: number) {
    detailTaskId.value = taskId
    syncTaskQueryParam(taskId)
  }

  function openTaskDetail (task: WorkspaceBoardTask) {
    if (editingTaskId.value === task.id || suppressTaskCardClick.value) return
    closeCardMenu()
    openTaskDetailById(task.id)
  }

  function onTaskDetailMissing () {
    detailTaskId.value = null
    void navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
  }

  function onTaskDetailNavigate (taskId: number) {
    if (detailTaskId.value === taskId) {
      return
    }
    openTaskDetailById(taskId)
  }

  const taskDetailOpen = computed({
    get: () => detailTaskId.value !== null,
    set: (open: boolean) => {
      if (!open) {
        detailTaskId.value = null
        clearTaskQueryParam()
      }
    },
  })

  watch(
    () => [pageReady.value, route.query.task] as const,
    () => {
      applyTaskQueryFromRoute()
    },
  )

  return {
    parseTaskQueryId,
    syncTaskQueryParam,
    clearTaskQueryParam,
    applyTaskQueryFromRoute,
    openTaskDetail,
    openTaskDetailById,
    onTaskDetailMissing,
    onTaskDetailNavigate,
    taskDetailOpen,
  }
}
