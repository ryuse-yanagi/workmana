import { memberMatchesSearchQuery, type MemberLike } from './useMemberDisplay'
import { filterLabelCategories, type LabelCategoryGroup } from './useLabelCategories'

export type ListFilterSectionKey = 'assignee' | 'label' | 'status'

export type FilterableWorkspaceLike = {
  labels?: Array<{ id: number }> | null
  assignees?: Array<{ id: number }> | null
  status?: { name: string } | null
}

/**
 * スペース一覧の絞り込み UI 状態とマッチ判定。
 * ボード / WBS の `useWorkspaceTaskFilters`（schedule・配列）とは別物（status・Set）。
 */
export function useWorkspaceListFilters (options: {
  orgMembers: MaybeRefOrGetter<MemberLike[]>
  orgLabelCategories: MaybeRefOrGetter<LabelCategoryGroup[]>
  workspaceStatuses: MaybeRefOrGetter<Array<{ name: string }>>
}) {
  const assigneeFilterSelected = ref<string[]>([])
  const labelFilterSelected = ref(new Set<string>())
  const statusFilterSelected = ref(new Set<string>())
  const assigneeFilterSearchQuery = ref('')
  const labelFilterSearchQuery = ref('')

  const hasActiveListFilters = computed(() => (
    assigneeFilterSelected.value.length > 0
    || labelFilterSelected.value.size > 0
    || statusFilterSelected.value.size > 0
  ))

  const filteredAssigneeFilterMembers = computed(() =>
    toValue(options.orgMembers).filter(member =>
      memberMatchesSearchQuery(member, assigneeFilterSearchQuery.value),
    ),
  )

  const labelFilterCategories = computed(() =>
    filterLabelCategories(toValue(options.orgLabelCategories), labelFilterSearchQuery.value),
  )

  function matchesAssigneeFilter (workspace: FilterableWorkspaceLike): boolean {
    const selected = assigneeFilterSelected.value
    if (selected.length === 0) {
      return true
    }
    const assigneeIds = (workspace.assignees ?? []).map(member => member.id)
    const selectedMemberIds = selected.filter(key => key !== 'unset')
    const includesUnset = selected.includes('unset')
    const matchesUnset = includesUnset && assigneeIds.length === 0
    const matchesMember = selectedMemberIds.length > 0
      && assigneeIds.some(id => selectedMemberIds.includes(String(id)))
    return matchesUnset || matchesMember
  }

  function matchesLabelFilter (workspace: FilterableWorkspaceLike): boolean {
    if (labelFilterSelected.value.size === 0) {
      return true
    }
    const labels = workspace.labels ?? []
    if (labelFilterSelected.value.has('unset') && labels.length === 0) {
      return true
    }
    return labels.some(label => labelFilterSelected.value.has(String(label.id)))
  }

  function matchesStatusFilter (workspace: FilterableWorkspaceLike): boolean {
    if (statusFilterSelected.value.size === 0) {
      return true
    }
    const statusName = workspace.status?.name
    if (statusFilterSelected.value.has('unset') && !statusName) {
      return true
    }
    return Boolean(statusName && statusFilterSelected.value.has(statusName))
  }

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
    return labelFilterSelected.value.has(key)
  }

  function toggleLabelFilter (key: string) {
    const next = new Set(labelFilterSelected.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    labelFilterSelected.value = next
  }

  function isStatusFilterSelected (key: string): boolean {
    return statusFilterSelected.value.has(key)
  }

  function toggleStatusFilter (key: string) {
    const next = new Set(statusFilterSelected.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    statusFilterSelected.value = next
  }

  function clearListFilters () {
    assigneeFilterSelected.value = []
    labelFilterSelected.value = new Set()
    statusFilterSelected.value = new Set()
  }

  return {
    assigneeFilterSelected,
    labelFilterSelected,
    statusFilterSelected,
    assigneeFilterSearchQuery,
    labelFilterSearchQuery,
    hasActiveListFilters,
    filteredAssigneeFilterMembers,
    labelFilterCategories,
    matchesAssigneeFilter,
    matchesLabelFilter,
    matchesStatusFilter,
    isAssigneeFilterSelected,
    setAssigneeFilter,
    isLabelFilterSelected,
    toggleLabelFilter,
    isStatusFilterSelected,
    toggleStatusFilter,
    clearListFilters,
  }
}
