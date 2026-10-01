import type { Ref } from 'vue'
import { memberMatchesSearchQuery, type MemberLike } from '../member/useMemberDisplay'
import { filterLabelCategories, type LabelCategoryGroup } from '../label/useLabelCategories'
import {
  createEmptyWorkspaceTaskFilters,
  matchesWorkspaceTaskFilters,
  SCHEDULE_FILTER_OPTIONS,
  workspaceTaskFiltersAreActive,
  type FilterableTaskLike,
  type ScheduleFilterKey,
  type WorkspaceTaskFilters,
} from '../../utils/task/workspaceTaskFilters'

export type TaskFilterSectionKey = 'assignee' | 'label' | 'schedule'

/** 絞り込み状態を空に戻す。スペース詳細のタスクフィルターとスペース一覧で共有する。 */
export function clearFilters<T> (filters: Ref<T>, createEmpty: () => T) {
  filters.value = createEmpty()
}

/**
 * ボード / WBS で共有するタスク絞り込み UI 状態とマッチ判定。
 * `taskFilters` は defineModel など外部 Ref を渡す。
 */
export function useWorkspaceTaskFilters (
  taskFilters: Ref<WorkspaceTaskFilters>,
  options: {
    members: MaybeRefOrGetter<MemberLike[]>
    labelCategories: MaybeRefOrGetter<LabelCategoryGroup[]>
  },
) {
  const assigneeFilterSelected = computed({
    get: () => taskFilters.value.assignees,
    set: (assignees) => {
      taskFilters.value = { ...taskFilters.value, assignees }
    },
  })
  const labelFilterSelected = computed({
    get: () => taskFilters.value.labels,
    set: (labels) => {
      taskFilters.value = { ...taskFilters.value, labels }
    },
  })
  const scheduleFilterSelected = computed({
    get: () => taskFilters.value.schedule,
    set: (schedule) => {
      taskFilters.value = { ...taskFilters.value, schedule }
    },
  })

  const scheduleFilterOptions = SCHEDULE_FILTER_OPTIONS
  const assigneeFilterSearchQuery = ref('')
  const labelFilterSearchQuery = ref('')
  const filterSectionsOpen = reactive<Record<TaskFilterSectionKey, boolean>>({
    assignee: true,
    label: true,
    schedule: true,
  })

  const hasActiveFilters = computed(() => workspaceTaskFiltersAreActive(taskFilters.value))

  const filteredAssigneeFilterMembers = computed(() =>
    toValue(options.members).filter(member =>
      memberMatchesSearchQuery(member, assigneeFilterSearchQuery.value),
    ),
  )

  const labelFilterCategories = computed(() =>
    filterLabelCategories(toValue(options.labelCategories), labelFilterSearchQuery.value),
  )

  function isAssigneeFilterSelected (key: string): boolean {
    return assigneeFilterSelected.value.includes(key)
  }

  function setAssigneeFilter (key: string, event: Event) {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
      return
    }
    const selected = new Set(assigneeFilterSelected.value)
    if (input.checked) {
      selected.add(key)
    } else {
      selected.delete(key)
    }
    assigneeFilterSelected.value = [...selected]
  }

  function isLabelFilterSelected (key: string): boolean {
    return labelFilterSelected.value.includes(key)
  }

  function toggleLabelFilter (key: string) {
    const next = new Set(labelFilterSelected.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    labelFilterSelected.value = [...next]
  }

  function isScheduleFilterSelected (key: ScheduleFilterKey): boolean {
    return scheduleFilterSelected.value.includes(key)
  }

  function toggleScheduleFilter (key: ScheduleFilterKey) {
    const next = new Set(scheduleFilterSelected.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    scheduleFilterSelected.value = [...next]
  }

  function clearTaskFilters () {
    clearFilters(taskFilters, createEmptyWorkspaceTaskFilters)
  }

  function clearFilterSearchQueries () {
    assigneeFilterSearchQuery.value = ''
    labelFilterSearchQuery.value = ''
  }

  function matchesFilters (task: FilterableTaskLike): boolean {
    return matchesWorkspaceTaskFilters(task, taskFilters.value)
  }

  return {
    assigneeFilterSelected,
    labelFilterSelected,
    scheduleFilterSelected,
    scheduleFilterOptions,
    assigneeFilterSearchQuery,
    labelFilterSearchQuery,
    filterSectionsOpen,
    hasActiveFilters,
    filteredAssigneeFilterMembers,
    labelFilterCategories,
    isAssigneeFilterSelected,
    setAssigneeFilter,
    isLabelFilterSelected,
    toggleLabelFilter,
    isScheduleFilterSelected,
    toggleScheduleFilter,
    clearFilters: clearTaskFilters,
    clearFilterSearchQueries,
    matchesFilters,
  }
}
