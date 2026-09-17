import type { Ref } from 'vue'
import type {
  TaskDetail,
  TaskDetailLabel,
  TaskDetailMember,
} from '../components/modals/TaskDetailModal.vue'
import { useApi } from './useApi'
import { sortMembersByDisplayName } from './useMemberDisplay'
import { sortLabelsByCatalogOrder } from './useLabelCategories'
import { toDateInputValue } from './useTaskFormHelpers'

/**
 * タスク詳細の日付・担当・ラベル・リスト PATCH ミューテーション。
 * ポップオーバー開閉（beginPopoverOpen 依存）は SFC 側に残す。
 */
export function useTaskDetailPatchMutations (options: {
  task: Ref<TaskDetail | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  taskId: MaybeRefOrGetter<number | null>
  orgLabels: MaybeRefOrGetter<TaskDetailLabel[]>
  saving: Ref<boolean>
  saveError: Ref<string | null>
  popoverError: Ref<string | null>
  pendingDate: Ref<string | null>
  isStillShowingTask: (requestTaskId: number) => boolean
  applyUpdatedTaskIfCurrent: (requestTaskId: number, updated: TaskDetail) => boolean
  armOverlayCloseGuard: (ms?: number) => void
  onUpdated?: (detail: TaskDetail) => void
}) {
  const { api } = useApi()
  const dateSaving = ref(false)
  const listSaving = ref(false)
  const pickerMutationPending = ref(false)

  function patchTaskDateRange (startDate: string | null, dueDate: string | null) {
    if (!options.task.value) return
    options.task.value = {
      ...options.task.value,
      start_date: startDate,
      due_date: dueDate,
    }
  }

  async function applyPeriodRange (nextRange: { start_date: string; due_date: string }) {
    if (!options.task.value) return
    const requestTaskId = options.task.value.id
    const prevStart = options.task.value.start_date ?? null
    const prevDue = options.task.value.due_date ?? null
    if (
      toDateInputValue(prevStart) === nextRange.start_date
      && toDateInputValue(prevDue) === nextRange.due_date
    ) {
      options.popoverError.value = null
      return
    }
    options.pendingDate.value = nextRange.start_date
    patchTaskDateRange(nextRange.start_date, nextRange.due_date)
    options.saveError.value = null
    options.popoverError.value = null
    dateSaving.value = true
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: nextRange },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.pendingDate.value = toDateInputValue(options.task.value.start_date) || nextRange.start_date
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      patchTaskDateRange(prevStart, prevDue)
      options.pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
      options.popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        dateSaving.value = false
      }
    }
  }

  async function clearCalendarDate () {
    if (!options.task.value || dateSaving.value || options.saving.value) return
    const requestTaskId = options.task.value.id
    const prevStart = options.task.value.start_date ?? null
    const prevDue = options.task.value.due_date ?? null
    options.pendingDate.value = null
    if (!prevStart && !prevDue) {
      return
    }
    patchTaskDateRange(null, null)
    options.saveError.value = null
    options.popoverError.value = null
    dateSaving.value = true
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { start_date: null, due_date: null } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      patchTaskDateRange(prevStart, prevDue)
      options.pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
      options.popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        dateSaving.value = false
      }
    }
  }

  async function clearAssignees () {
    if (!options.task.value || pickerMutationPending.value || options.saving.value) return
    const requestTaskId = options.task.value.id
    const previousAssignees = [...options.task.value.assignees]
    if (!previousAssignees.length) return
    options.armOverlayCloseGuard()
    pickerMutationPending.value = true
    options.task.value = {
      ...options.task.value,
      assignees: [],
    }
    options.popoverError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { assignee_ids: [] } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.task.value = { ...options.task.value, assignees: previousAssignees }
      options.popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        pickerMutationPending.value = false
      }
    }
  }

  async function clearLabels () {
    if (!options.task.value || pickerMutationPending.value || options.saving.value) return
    const requestTaskId = options.task.value.id
    const previousLabels = [...options.task.value.labels]
    if (!previousLabels.length) return
    options.armOverlayCloseGuard()
    pickerMutationPending.value = true
    options.task.value = {
      ...options.task.value,
      labels: [],
    }
    options.popoverError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { label_ids: [] } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.task.value = { ...options.task.value, labels: previousLabels }
      options.popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        pickerMutationPending.value = false
      }
    }
  }

  async function toggleMember (member: TaskDetailMember) {
    if (!options.task.value || pickerMutationPending.value) return
    const requestTaskId = options.task.value.id
    options.armOverlayCloseGuard()
    pickerMutationPending.value = true
    const previousAssignees = [...options.task.value.assignees]
    const currentIds = previousAssignees.map(m => m.id)
    const isAssigned = currentIds.includes(member.id)
    const assignee_ids = isAssigned
      ? currentIds.filter(id => id !== member.id)
      : [...currentIds, member.id]
    options.task.value = {
      ...options.task.value,
      assignees: sortMembersByDisplayName(
        isAssigned
          ? previousAssignees.filter(m => m.id !== member.id)
          : [...previousAssignees, member],
      ),
    }
    options.popoverError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { assignee_ids } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.task.value = { ...options.task.value, assignees: previousAssignees }
      options.popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        pickerMutationPending.value = false
      }
    }
  }

  async function toggleLabel (label: TaskDetailLabel) {
    if (!options.task.value || pickerMutationPending.value) return
    const requestTaskId = options.task.value.id
    options.armOverlayCloseGuard()
    pickerMutationPending.value = true
    const previousLabels = [...options.task.value.labels]
    const currentIds = previousLabels.map(item => item.id)
    const isSelected = currentIds.includes(label.id)
    const label_ids = isSelected
      ? currentIds.filter(id => id !== label.id)
      : [...currentIds, label.id]
    options.task.value = {
      ...options.task.value,
      labels: sortLabelsByCatalogOrder(
        isSelected
          ? previousLabels.filter(item => item.id !== label.id)
          : [...previousLabels, label],
        toValue(options.orgLabels),
      ),
    }
    options.popoverError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { label_ids } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.task.value = { ...options.task.value, labels: previousLabels }
      options.popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        pickerMutationPending.value = false
      }
    }
  }

  async function selectList (listId: number) {
    if (!options.task.value || listSaving.value || options.saving.value) return
    if (options.task.value.list_id === listId) return
    const requestTaskId = options.task.value.id
    options.armOverlayCloseGuard()
    listSaving.value = true
    options.popoverError.value = null
    const previousListId = options.task.value.list_id
    const previousSortOrder = options.task.value.sort_order
    options.task.value = {
      ...options.task.value,
      list_id: listId,
    }
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { list_id: listId } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.task.value = {
        ...options.task.value,
        list_id: previousListId,
        sort_order: previousSortOrder,
      }
      options.popoverError.value = e instanceof Error ? e.message : 'リストの更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        listSaving.value = false
      }
    }
  }

  return {
    dateSaving,
    listSaving,
    pickerMutationPending,
    patchTaskDateRange,
    applyPeriodRange,
    clearCalendarDate,
    clearAssignees,
    clearLabels,
    toggleMember,
    toggleLabel,
    selectList,
  }
}
