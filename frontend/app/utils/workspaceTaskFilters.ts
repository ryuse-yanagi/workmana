/** スペース詳細（ボード / WBS）で共有するタスク絞り込み */
export type ScheduleFilterKey = 'unset' | 'before_start' | 'in_progress' | 'after_end'

export type WorkspaceTaskFilters = {
  assignees: string[]
  labels: string[]
  schedule: ScheduleFilterKey[]
}

export type FilterableTaskLike = {
  assignees?: Array<{ id: number }> | null
  labels?: Array<{ id: number }> | null
  start_date?: string | null
  due_date?: string | null
}

export const SCHEDULE_FILTER_OPTIONS: Array<{ key: ScheduleFilterKey; label: string }> = [
  { key: 'unset', label: '未設定' },
  { key: 'before_start', label: '開始予定日より前' },
  { key: 'in_progress', label: '予定期間内' },
  { key: 'after_end', label: '終了予定日より後' },
]

export function createEmptyWorkspaceTaskFilters (): WorkspaceTaskFilters {
  return {
    assignees: [],
    labels: [],
    schedule: [],
  }
}

export function workspaceTaskFiltersAreActive (filters: WorkspaceTaskFilters): boolean {
  return filters.assignees.length > 0
    || filters.labels.length > 0
    || filters.schedule.length > 0
}

export function normalizeTaskDate (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return null
  }
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function todayIso (): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function compareIsoDates (left: string, right: string): number {
  return left.localeCompare(right)
}

export function getTaskScheduleCategories (
  task: Pick<FilterableTaskLike, 'start_date' | 'due_date'>,
  today: string = todayIso(),
): ScheduleFilterKey[] {
  const startIso = normalizeTaskDate(task.start_date)
  const dueIso = normalizeTaskDate(task.due_date)
  const categories: ScheduleFilterKey[] = []
  if (!startIso && !dueIso) {
    categories.push('unset')
    return categories
  }
  if (startIso && compareIsoDates(today, startIso) < 0) {
    categories.push('before_start')
  }
  if (dueIso && compareIsoDates(today, dueIso) > 0) {
    categories.push('after_end')
  }
  let inProgress = false
  if (startIso && !dueIso) {
    inProgress = compareIsoDates(today, startIso) >= 0
  } else if (!startIso && dueIso) {
    inProgress = compareIsoDates(today, dueIso) <= 0
  } else if (startIso && dueIso) {
    inProgress = compareIsoDates(today, startIso) >= 0 && compareIsoDates(today, dueIso) <= 0
  }
  if (inProgress) {
    categories.push('in_progress')
  }
  return categories
}

export function taskAssigneeUserIds (task: Pick<FilterableTaskLike, 'assignees'>): number[] {
  return (task.assignees ?? [])
    .map(assignee => assignee.id)
    .filter(id => Number.isFinite(id))
}

export function matchesTaskAssigneeFilter (
  task: Pick<FilterableTaskLike, 'assignees'>,
  selected: string[],
): boolean {
  if (selected.length === 0) {
    return true
  }
  const assigneeIds = taskAssigneeUserIds(task)
  const selectedMemberIds = selected.filter(key => key !== 'unset')
  const includesUnset = selected.includes('unset')
  const matchesUnset = includesUnset && assigneeIds.length === 0
  const matchesMember = selectedMemberIds.length > 0
    && assigneeIds.some(id => selectedMemberIds.includes(String(id)))
  return matchesUnset || matchesMember
}

export function matchesTaskLabelFilter (
  task: Pick<FilterableTaskLike, 'labels'>,
  selected: string[],
): boolean {
  if (selected.length === 0) {
    return true
  }
  const labels = task.labels ?? []
  if (selected.includes('unset') && labels.length === 0) {
    return true
  }
  return labels.some(label => selected.includes(String(label.id)))
}

export function matchesTaskScheduleFilter (
  task: Pick<FilterableTaskLike, 'start_date' | 'due_date'>,
  selected: ScheduleFilterKey[],
  today: string = todayIso(),
): boolean {
  if (selected.length === 0) {
    return true
  }
  const categories = getTaskScheduleCategories(task, today)
  return categories.some(category => selected.includes(category))
}

export function matchesWorkspaceTaskFilters (
  task: FilterableTaskLike,
  filters: WorkspaceTaskFilters,
  today: string = todayIso(),
): boolean {
  return matchesTaskAssigneeFilter(task, filters.assignees)
    && matchesTaskLabelFilter(task, filters.labels)
    && matchesTaskScheduleFilter(task, filters.schedule, today)
}
