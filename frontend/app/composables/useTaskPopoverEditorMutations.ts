import type { Ref } from 'vue'
import {
  resolveAndSortLabels,
  sortLabelsByCatalogOrder,
} from './useLabelCategories'
import {
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
  effortValueToDraft,
  normalizeEffortHours,
  normalizeProgressRate,
  parseEffortDraft,
  parseProgressRateDraft,
  progressRateValueToDraft,
  resolveStoredEffortValue,
  resolveStoredProgressRate,
  toDateInputValue,
  resolveTaskDateRangePick,
} from './useTaskFormHelpers'
import { sortMembersByDisplayName } from './useMemberDisplay'
import type {
  PopoverType,
  TaskPopoverEditable,
  WorkspaceListOption,
} from './useTaskPopoverEditor'
import type { useApi } from './useApi'

type TaskPatchResponse = {
  id: number
  title: string
  description: string | null
  list_id?: number | null
  sort_order?: number
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  progress_rate: number | string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}

export function resolveListName (
  listId: number | null | undefined,
  lists: WorkspaceListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.name ?? null
}

export function resolveListColor (
  listId: number | null | undefined,
  lists: WorkspaceListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.color ?? null
}

function effortSource (
  task: TaskPopoverEditable,
): Pick<TaskFormDraft, 'effort_hours'> {
  return {
    effort_hours: task.effort_hours ?? null,
  }
}

function progressRateSource (
  task: TaskPopoverEditable,
): Pick<TaskFormDraft, 'progress_rate'> {
  return {
    progress_rate: task.progress_rate ?? null,
  }
}

function patchToEditable (
  patch: TaskPatchResponse,
  previous: TaskPopoverEditable,
  lists: WorkspaceListOption[],
  catalogLabels: Array<{ id: number }> = [],
): TaskPopoverEditable {
  const listId = patch.list_id !== undefined ? patch.list_id : previous.list_id
  return {
    ...previous,
    id: patch.id,
    title: patch.title,
    description: patch.description,
    list_id: listId,
    list_name: resolveListName(listId, lists) ?? previous.list_name ?? null,
    sort_order: patch.sort_order !== undefined ? patch.sort_order : previous.sort_order,
    start_date: patch.start_date,
    due_date: patch.due_date,
    effort_hours: patch.effort_hours,
    progress_rate: patch.progress_rate,
    assignees: sortMembersByDisplayName(patch.assignees),
    labels: patch.labels !== undefined
      ? resolveAndSortLabels(patch.labels, catalogLabels)
      : previous.labels,
  }
}

type UseTaskPopoverEditorMutationsOptions = {
  api: ReturnType<typeof useApi>['api']
  orgSlug: string
  workspaceId: string
  orgLabels: Ref<TaskFormLabel[]>
  workspaceLists: Ref<WorkspaceListOption[]>
  task: Ref<TaskPopoverEditable | null>
  onUpdated: (task: TaskPopoverEditable) => void
  disabled?: Ref<boolean>
  readonlyDescription?: Ref<boolean>
  activePopover: Ref<PopoverType | null>
  popoverError: Ref<string | null>
  pendingDate: Ref<string | null>
  effortDraft: Ref<string | number>
  progressRateDraft: Ref<string | number>
  descriptionDraft: Ref<string>
  dateSaving: Ref<boolean>
  effortSaving: Ref<boolean>
  progressRateSaving: Ref<boolean>
  descriptionSaving: Ref<boolean>
  listSaving: Ref<boolean>
  pickerMutationPending: Ref<boolean>
  dismissPopover: () => void
  resolveEffortInputEl: () => HTMLInputElement | null
  resolveProgressRateInputEl: () => HTMLInputElement | null
}

/**
 * タスク編集ポップオーバーの PATCH／保存ハンドラ。
 * open* や配置ロジックは useTaskPopoverEditor 側に残す。
 */
export function useTaskPopoverEditorMutations (
  options: UseTaskPopoverEditorMutationsOptions,
) {
  function isDisabled (): boolean {
    return options.disabled?.value ?? false
  }

  function taskEndpoint (): string | null {
    const task = options.task.value
    if (!task) return null
    return `/orgs/${options.orgSlug}/workspaces/${options.workspaceId}/tasks/${task.id}`
  }

  function resetTransientMutationLocks () {
    options.listSaving.value = false
    options.pickerMutationPending.value = false
    options.dateSaving.value = false
    options.effortSaving.value = false
    options.progressRateSaving.value = false
    options.descriptionSaving.value = false
  }

  function patchLocalTask (patch: Partial<TaskPopoverEditable>) {
    const task = options.task.value
    if (!task) return
    const merged = { ...task, ...patch }
    options.task.value = merged
    options.onUpdated(merged)
  }

  function previewDescriptionInWbs () {
    // 閲覧専用では下書きの同期プレビューを行わない
    if (options.readonlyDescription?.value) return
    if (options.activePopover.value !== 'description') return
    const task = options.task.value
    if (!task) return
    const description = options.descriptionDraft.value
    options.onUpdated({
      ...task,
      description: description.trim() === '' ? null : description,
    })
  }

  function previewEffortInWbs () {
    if (options.activePopover.value !== 'effort') return
    const task = options.task.value
    if (!task) return
    const parsed = parseEffortDraft(options.effortDraft.value)
    if (parsed === 'invalid') return
    const effortHours = parsed === null ? null : normalizeEffortHours(parsed)
    options.onUpdated({
      ...task,
      effort_hours: effortHours,
    })
  }

  function previewProgressRateInWbs () {
    if (options.activePopover.value !== 'progress-rate') return
    const task = options.task.value
    if (!task) return
    const parsed = parseProgressRateDraft(options.progressRateDraft.value)
    if (parsed === 'invalid') return
    const progressRate = parsed === null ? null : normalizeProgressRate(parsed)
    options.onUpdated({
      ...task,
      progress_rate: progressRate,
    })
  }

  async function applyPatchResponse (updated: TaskPatchResponse) {
    const task = options.task.value
    if (!task || updated.id !== task.id) return
    const merged = patchToEditable(
      updated,
      task,
      options.workspaceLists.value,
      options.orgLabels.value,
    )
    options.task.value = merged
    options.onUpdated(merged)
  }

  async function saveEffort () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.effortSaving.value) return false
    const parsed = parseEffortDraft(options.effortDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '工数は0以上の数値で入力してください'
      options.effortDraft.value = effortValueToDraft(effortSource(task))
      return false
    }
    const effortHours = parsed === null ? null : normalizeEffortHours(parsed)
    const currentValue = resolveStoredEffortValue(effortSource(task))
    if (effortHours === currentValue) {
      options.popoverError.value = null
      return true
    }
    const previousHours = task.effort_hours ?? null
    patchLocalTask({
      effort_hours: effortHours,
    })
    options.effortSaving.value = true
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { effort_hours: effortHours },
      })
      await applyPatchResponse(updated)
      options.effortDraft.value = effortValueToDraft(
        effortSource(options.task.value ?? task),
      )
      return true
    } catch (e: unknown) {
      patchLocalTask({
        effort_hours: previousHours,
      })
      options.effortDraft.value = effortValueToDraft(effortSource(task))
      options.popoverError.value = e instanceof Error ? e.message : '工数の更新に失敗しました'
      return false
    } finally {
      options.effortSaving.value = false
    }
  }

  async function finalizeEffortPopover () {
    const closing = options.activePopover.value
    if (closing !== 'effort') return
    const parsed = parseEffortDraft(options.effortDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '工数は0以上の数値で入力してください'
      return
    }
    options.popoverError.value = null
    const saved = await saveEffort()
    if (!saved) {
      return
    }
    // 保存中に別ポップオーバーへ切り替わっていたら閉じない
    if (options.activePopover.value !== closing) return
    options.dismissPopover()
  }

  async function saveProgressRate () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.progressRateSaving.value) return false
    const parsed = parseProgressRateDraft(options.progressRateDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '進捗率は0〜100の整数で入力してください'
      options.progressRateDraft.value = progressRateValueToDraft(progressRateSource(task))
      return false
    }
    const progressRate = parsed === null ? null : normalizeProgressRate(parsed)
    const currentValue = resolveStoredProgressRate(progressRateSource(task))
    if (progressRate === currentValue) {
      options.popoverError.value = null
      return true
    }
    const previousRate = task.progress_rate ?? null
    patchLocalTask({
      progress_rate: progressRate,
    })
    options.progressRateSaving.value = true
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { progress_rate: progressRate },
      })
      await applyPatchResponse(updated)
      options.progressRateDraft.value = progressRateValueToDraft(
        progressRateSource(options.task.value ?? task),
      )
      return true
    } catch (e: unknown) {
      patchLocalTask({
        progress_rate: previousRate,
      })
      options.progressRateDraft.value = progressRateValueToDraft(progressRateSource(task))
      options.popoverError.value = e instanceof Error ? e.message : '進捗率の更新に失敗しました'
      return false
    } finally {
      options.progressRateSaving.value = false
    }
  }

  async function finalizeProgressRatePopover () {
    const closing = options.activePopover.value
    if (closing !== 'progress-rate') return
    const parsed = parseProgressRateDraft(options.progressRateDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '進捗率は0〜100の整数で入力してください'
      return
    }
    options.popoverError.value = null
    const saved = await saveProgressRate()
    if (!saved) {
      return
    }
    if (options.activePopover.value !== closing) return
    options.dismissPopover()
  }

  async function saveDescription () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.descriptionSaving.value) return
    const description = options.descriptionDraft.value
    const normalized = description.trim() === '' ? null : description
    if ((normalized ?? '') === (task.description ?? '')) return
    options.descriptionSaving.value = true
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { description: normalized },
      })
      await applyPatchResponse(updated)
      options.descriptionDraft.value = options.task.value?.description ?? ''
    } catch (e: unknown) {
      options.popoverError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
    } finally {
      options.descriptionSaving.value = false
    }
  }

  async function pickCalendarDay (iso: string) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (
      !task
      || !endpoint
      || options.activePopover.value !== 'period'
      || options.dateSaving.value
    ) {
      return
    }
    const nextRange = resolveTaskDateRangePick(iso, task.start_date, task.due_date)
    if (!nextRange) {
      options.popoverError.value = null
      return
    }
    await applyPeriodRange(nextRange)
  }

  async function pickCalendarRange (range: { start_date: string; due_date: string }) {
    if (options.activePopover.value !== 'period' || options.dateSaving.value) return
    await applyPeriodRange(range)
  }

  async function applyPeriodRange (nextRange: { start_date: string; due_date: string }) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint) return
    const prevStart = task.start_date ?? null
    const prevDue = task.due_date ?? null
    if (
      toDateInputValue(prevStart) === nextRange.start_date
      && toDateInputValue(prevDue) === nextRange.due_date
    ) {
      options.popoverError.value = null
      return
    }
    options.pendingDate.value = nextRange.start_date
    patchLocalTask(nextRange)
    options.popoverError.value = null
    options.dateSaving.value = true
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: nextRange,
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ start_date: prevStart, due_date: prevDue })
      options.pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
      options.popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      options.dateSaving.value = false
    }
  }

  async function clearCalendarDate () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (
      !task
      || !endpoint
      || options.activePopover.value !== 'period'
      || options.dateSaving.value
      || isDisabled()
    ) {
      return
    }
    const prevStart = task.start_date ?? null
    const prevDue = task.due_date ?? null
    options.pendingDate.value = null
    if (!prevStart && !prevDue) {
      return
    }
    patchLocalTask({ start_date: null, due_date: null })
    options.popoverError.value = null
    options.dateSaving.value = true
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { start_date: null, due_date: null },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ start_date: prevStart, due_date: prevDue })
      options.pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
      options.popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      options.dateSaving.value = false
    }
  }

  async function clearEffort () {
    if (isDisabled() || options.effortSaving.value) return
    options.effortDraft.value = ''
    options.popoverError.value = null
    const inputEl = options.resolveEffortInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    await saveEffort()
  }

  async function clearProgressRate () {
    if (isDisabled() || options.progressRateSaving.value) return
    options.progressRateDraft.value = ''
    options.popoverError.value = null
    const inputEl = options.resolveProgressRateInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    await saveProgressRate()
  }

  async function clearAssignees () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.pickerMutationPending.value || isDisabled()) return
    const previousAssignees = [...(task.assignees ?? [])]
    if (!previousAssignees.length) return
    options.pickerMutationPending.value = true
    patchLocalTask({ assignees: [] })
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { assignee_ids: [] },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ assignees: previousAssignees })
      options.popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
    } finally {
      options.pickerMutationPending.value = false
    }
  }

  async function clearLabels () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.pickerMutationPending.value || isDisabled()) return
    const previousLabels = [...(task.labels ?? [])]
    if (!previousLabels.length) return
    options.pickerMutationPending.value = true
    patchLocalTask({ labels: [] })
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { label_ids: [] },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ labels: previousLabels })
      options.popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    } finally {
      options.pickerMutationPending.value = false
    }
  }

  async function clearDescription () {
    if (
      options.readonlyDescription?.value
      || isDisabled()
      || options.descriptionSaving.value
    ) {
      return
    }
    options.descriptionDraft.value = ''
    previewDescriptionInWbs()
    await saveDescription()
  }

  async function selectList (listId: number) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.listSaving.value || isDisabled()) return
    if (task.list_id === listId) return
    options.listSaving.value = true
    const previousListId = task.list_id ?? null
    const previousListName = task.list_name ?? null
    const previousSortOrder = task.sort_order
    const nextListName = resolveListName(listId, options.workspaceLists.value)
    patchLocalTask({
      list_id: listId,
      list_name: nextListName,
    })
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { list_id: listId },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({
        list_id: previousListId,
        list_name: previousListName,
        sort_order: previousSortOrder,
      })
      options.popoverError.value = e instanceof Error ? e.message : 'リストの更新に失敗しました'
    } finally {
      options.listSaving.value = false
    }
  }

  function isMemberAssigned (memberId: number): boolean {
    return (options.task.value?.assignees ?? []).some(member => member.id === memberId)
  }

  function isLabelSelected (labelId: number): boolean {
    return (options.task.value?.labels ?? []).some(label => label.id === labelId)
  }

  async function toggleMember (member: TaskFormMember) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.pickerMutationPending.value || isDisabled()) return
    options.pickerMutationPending.value = true
    const previousAssignees = [...(task.assignees ?? [])]
    const currentIds = previousAssignees.map(m => m.id)
    const isAssigned = currentIds.includes(member.id)
    const assignee_ids = isAssigned
      ? currentIds.filter(id => id !== member.id)
      : [...currentIds, member.id]
    patchLocalTask({
      assignees: sortMembersByDisplayName(
        isAssigned
          ? previousAssignees.filter(m => m.id !== member.id)
          : [...previousAssignees, member],
      ),
    })
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { assignee_ids },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ assignees: previousAssignees })
      options.popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
    } finally {
      options.pickerMutationPending.value = false
    }
  }

  async function removeMember (member: TaskFormMember) {
    if (!isMemberAssigned(member.id)) return
    await toggleMember(member)
    if (!isMemberAssigned(member.id)) {
      options.dismissPopover()
    }
  }

  async function toggleLabel (label: TaskFormLabel) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || options.pickerMutationPending.value || isDisabled()) return
    options.pickerMutationPending.value = true
    const previousLabels = [...(task.labels ?? [])]
    const currentIds = previousLabels.map(item => item.id)
    const isSelected = currentIds.includes(label.id)
    const label_ids = isSelected
      ? currentIds.filter(id => id !== label.id)
      : [...currentIds, label.id]
    patchLocalTask({
      labels: sortLabelsByCatalogOrder(
        isSelected
          ? previousLabels.filter(item => item.id !== label.id)
          : [...previousLabels, label],
        options.orgLabels.value,
      ),
    })
    options.popoverError.value = null
    try {
      const updated = await options.api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { label_ids },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ labels: previousLabels })
      options.popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    } finally {
      options.pickerMutationPending.value = false
    }
  }

  return {
    effortSource,
    progressRateSource,
    resetTransientMutationLocks,
    previewDescriptionInWbs,
    previewEffortInWbs,
    previewProgressRateInWbs,
    saveEffort,
    finalizeEffortPopover,
    saveProgressRate,
    finalizeProgressRatePopover,
    saveDescription,
    pickCalendarDay,
    pickCalendarRange,
    clearCalendarDate,
    clearEffort,
    clearProgressRate,
    clearAssignees,
    clearLabels,
    clearDescription,
    selectList,
    isMemberAssigned,
    isLabelSelected,
    toggleMember,
    removeMember,
    toggleLabel,
  }
}
