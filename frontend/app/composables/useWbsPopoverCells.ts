import type { Ref } from 'vue'
import type { WbsTask } from './useWbsTaskGroups'
import {
  type PopoverType,
  type TaskPopoverEditable,
  type WorkspaceListOption,
  resolveListColor,
} from './useTaskPopoverEditor'
import type { TaskFormMember } from './useTaskFormHelpers'
import { useApi } from './useApi'
import { useWorkspaceBoardPageData } from './useWorkspaceBoardPageData'

export type WbsPopoverCellField =
  | 'assignees'
  | 'labels'
  | 'list'
  | 'period'
  | 'effort'
  | 'progressRate'
  | 'notes'

/** TaskEditPopoverLayer の WBS 向け公開 API（コンポーネント依存を避ける） */
export type WbsTaskEditLayerExpose = {
  bindTask: (task: TaskPopoverEditable | null) => Promise<void> | void
  openDatePicker: (event?: Event) => void
  openEffortPicker: (event?: Event) => void
  openProgressRatePicker: (event?: Event) => void
  openMemberPicker: (event?: Event) => void
  openMemberDetail: (member: TaskFormMember, event?: Event) => void
  openLabelPicker: (event?: Event) => void
  openDescriptionPicker: (event?: Event) => void
  openListPicker: (event?: Event) => void
}

function normalizeDateOnly (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

export function useWbsPopoverCells (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  editMode: MaybeRefOrGetter<boolean>
  tasks: Ref<WbsTask[]>
  workspaceLists: Ref<WorkspaceListOption[]>
  editLayerRef: Ref<WbsTaskEditLayerExpose | null>
  persistWbsCache: () => void
  resolveGanttColorForDateChange: (
    task: WbsTask,
    nextStart: string | null,
    nextDue: string | null,
  ) => { nextColor: string | null; colorChanged: boolean }
}) {
  const { api } = useApi()
  const { patchCachedTasks } = useWorkspaceBoardPageData()

  const popoverActiveTaskId = ref<number | null>(null)
  const popoverActiveType = ref<PopoverType | null>(null)
  const popoverActiveMemberId = ref<number | null>(null)

  function onPopoverActiveChange (payload: {
    taskId: number | null
    popover: PopoverType | null
    memberId: number | null
  }) {
    popoverActiveTaskId.value = payload.taskId
    popoverActiveType.value = payload.popover
    popoverActiveMemberId.value = payload.memberId
  }

  function popoverTypeToCellField (popover: PopoverType): WbsPopoverCellField | null {
    switch (popover) {
      case 'period': return 'period'
      case 'effort': return 'effort'
      case 'progress-rate': return 'progressRate'
      case 'members':
      case 'member-detail': return 'assignees'
      case 'labels': return 'labels'
      case 'list': return 'list'
      case 'description': return 'notes'
      default: return null
    }
  }

  function isPopoverCellActive (taskId: number, field: WbsPopoverCellField): boolean {
    if (popoverActiveTaskId.value !== taskId || !popoverActiveType.value) {
      return false
    }
    return popoverTypeToCellField(popoverActiveType.value) === field
  }

  function isAssigneeDetailActive (taskId: number, memberId: number): boolean {
    return popoverActiveTaskId.value === taskId
      && popoverActiveType.value === 'member-detail'
      && popoverActiveMemberId.value === memberId
  }

  function isAssigneePickerActive (taskId: number): boolean {
    return popoverActiveTaskId.value === taskId && popoverActiveType.value === 'members'
  }

  async function bindAndOpen (
    task: WbsTask,
    opener: (event?: Event) => void,
    event: Event,
  ) {
    if (!toValue(options.editMode)) {
      return
    }
    await options.editLayerRef.value?.bindTask(task)
    opener(event)
  }

  function openPeriod (task: WbsTask, event: Event) {
    bindAndOpen(task, (e) => options.editLayerRef.value?.openDatePicker(e), event)
  }

  function openEffort (task: WbsTask, event: Event) {
    bindAndOpen(task, (e) => options.editLayerRef.value?.openEffortPicker(e), event)
  }

  function openProgressRate (task: WbsTask, event: Event) {
    bindAndOpen(task, (e) => options.editLayerRef.value?.openProgressRatePicker(e), event)
  }

  function openMembers (task: WbsTask, event: Event) {
    bindAndOpen(task, (e) => options.editLayerRef.value?.openMemberPicker(e), event)
  }

  function onMembersCellClick (task: WbsTask, event: MouseEvent) {
    if (!toValue(options.editMode)) {
      return
    }
    openMembers(task, event)
  }

  async function openMemberDetail (task: WbsTask, member: TaskFormMember, event: Event) {
    await options.editLayerRef.value?.bindTask(task)
    options.editLayerRef.value?.openMemberDetail(member, event)
  }

  function openLabels (task: WbsTask, event: Event) {
    bindAndOpen(task, (e) => options.editLayerRef.value?.openLabelPicker(e), event)
  }

  async function openDescription (task: WbsTask, event: Event) {
    if (!toValue(options.editMode) && !task.description?.trim()) {
      return
    }
    await options.editLayerRef.value?.bindTask(task)
    options.editLayerRef.value?.openDescriptionPicker(event)
  }

  function openList (task: WbsTask, event: Event) {
    bindAndOpen(task, (e) => options.editLayerRef.value?.openListPicker(e), event)
  }

  function listNameStyle (listId: number | null | undefined) {
    const color = resolveListColor(listId, options.workspaceLists.value)
    return color ? { color } : undefined
  }

  function syncTaskUpdate (updated: TaskPopoverEditable) {
    const idx = options.tasks.value.findIndex(task => task.id === updated.id)
    if (idx < 0) return
    const current = options.tasks.value[idx]!
    // 並び順はドラッグ操作のみで変更する
    const nextSortOrder = current.sort_order
    const nextStart = updated.start_date ?? null
    const nextDue = updated.due_date ?? null
    const datesChanged = normalizeDateOnly(current.start_date) !== normalizeDateOnly(nextStart)
      || normalizeDateOnly(current.due_date) !== normalizeDateOnly(nextDue)
    const { nextColor, colorChanged } = datesChanged
      ? options.resolveGanttColorForDateChange(current, nextStart, nextDue)
      : { nextColor: current.gantt_bar_color ?? null, colorChanged: false }
    // 更新は当該タスクのみ。他バーの色・日付は触らない
    options.tasks.value[idx] = {
      ...current,
      title: updated.title,
      description: updated.description,
      list_id: updated.list_id ?? current.list_id,
      list_name: updated.list_name ?? current.list_name,
      sort_order: nextSortOrder,
      start_date: nextStart,
      due_date: nextDue,
      ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
      effort_hours: updated.effort_hours,
      progress_rate: updated.progress_rate,
      assignees: updated.assignees,
      labels: updated.labels,
    }
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    patchCachedTasks(orgSlug, workspaceId, [{
      id: updated.id,
      title: updated.title,
      description: updated.description,
      list_id: updated.list_id ?? current.list_id,
      sort_order: nextSortOrder,
      start_date: nextStart,
      due_date: nextDue,
      ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
      effort_hours: updated.effort_hours,
      progress_rate: updated.progress_rate,
      assignees: updated.assignees,
      labels: updated.labels,
    }])
    options.persistWbsCache()
    if (colorChanged) {
      void api(
        `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/${updated.id}`,
        { method: 'PATCH', body: { gantt_bar_color: nextColor } },
      ).catch(() => {
        // 日付は保存済み。色の追従失敗時は再表示でフォールバック色を使う
      })
    }
  }

  return {
    popoverActiveTaskId,
    popoverActiveType,
    popoverActiveMemberId,
    onPopoverActiveChange,
    popoverTypeToCellField,
    isPopoverCellActive,
    isAssigneeDetailActive,
    isAssigneePickerActive,
    bindAndOpen,
    openPeriod,
    openEffort,
    openProgressRate,
    openMembers,
    onMembersCellClick,
    openMemberDetail,
    openLabels,
    openDescription,
    openList,
    listNameStyle,
    syncTaskUpdate,
  }
}
