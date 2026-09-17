import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'

/**
 * ボードの検索・フィルターに基づくタスク表示判定。
 */
export function useBoardTaskVisibility (options: {
  searchQuery: Ref<string> | ComputedRef<string>
  tasks: Ref<WorkspaceBoardTask[] | null>
  tasksByList: Record<string, WorkspaceBoardTask[]>
  matchesFilters: (task: WorkspaceBoardTask) => boolean
}) {
  const {
    searchQuery,
    tasks,
    tasksByList,
    matchesFilters,
  } = options

  const filteredTaskIds = computed<Set<number> | null>(() => {
    const query = searchQuery.value.toLowerCase()
    if (!query) return null
    const ids = new Set<number>()
    for (const task of tasks.value ?? []) {
      if (task.title.toLowerCase().includes(query)) ids.add(task.id)
    }
    return ids
  })

  function isTaskVisible (task: WorkspaceBoardTask) {
    const ids = filteredTaskIds.value
    const byQuery = !ids || ids.has(task.id)
    if (!byQuery) {
      return false
    }
    return matchesFilters(task)
  }

  const visibleTaskIdSet = computed(() => {
    const ids = new Set<number>()
    for (const task of tasks.value ?? []) {
      if (isTaskVisible(task)) {
        ids.add(task.id)
      }
    }
    return ids
  })

  function visibleCount (listKey: string) {
    const cards = tasksByList[listKey] ?? []
    return cards.filter(task => visibleTaskIdSet.value.has(task.id)).length
  }

  const visibleTaskCount = computed(() => visibleTaskIdSet.value.size)

  return {
    filteredTaskIds,
    isTaskVisible,
    visibleTaskIdSet,
    visibleCount,
    visibleTaskCount,
  }
}
