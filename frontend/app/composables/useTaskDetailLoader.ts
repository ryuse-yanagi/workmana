import type { Ref } from 'vue'
import type {
  TaskDetail,
  TaskDetailRemotePatch,
} from '../components/modals/TaskDetailModal.vue'
import type { TaskChecklist } from '../components/task/TaskDetailChecklistBlock.vue'
import type { TaskAttachmentItem } from '../components/task/taskAttachmentTypes'
import type { ParentTaskOption } from './useTaskDetailHierarchy'
import { useApi } from './useApi'
import { isAccessDeniedMessage } from '../utils/resourceAccessError'
import { popoverPositionVisibilityStyle } from '../utils/popoverScrollbar'

/**
 * タスク詳細モーダルの load / apply / reset / remote patch。
 */
export function useTaskDetailLoader (options: {
  task: Ref<TaskDetail | null>
  modelValue: MaybeRefOrGetter<boolean>
  taskId: MaybeRefOrGetter<number | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  initialTaskDetail: MaybeRefOrGetter<TaskDetail | null | undefined>
  initialParentTasks: MaybeRefOrGetter<ParentTaskOption[] | null | undefined>
  initialAttachments: MaybeRefOrGetter<TaskAttachmentItem[] | null | undefined>
  remoteUpdate: MaybeRefOrGetter<TaskDetailRemotePatch | null | undefined>
  remoteUpdateRev: MaybeRefOrGetter<number | undefined>
  saving: Ref<boolean>
  saveError: Ref<string | null>
  dateSaving: Ref<boolean>
  listSaving: Ref<boolean>
  pickerMutationPending: Ref<boolean>
  parentSaving: Ref<boolean>
  parentTasks: Ref<ParentTaskOption[]>
  parentTasksLoading: Ref<boolean>
  isNavigatingFade: Ref<boolean>
  titleDraft: Ref<string>
  titleComposing: Ref<boolean>
  titleSaving: Ref<boolean>
  descriptionDraft: Ref<string>
  descriptionSaving: Ref<boolean>
  descriptionTextareaRef: Ref<HTMLTextAreaElement | null>
  checklists: Ref<TaskChecklist[]>
  checklistSaving: Ref<boolean>
  effortDraft: Ref<string>
  effortSaving: Ref<boolean>
  effortInputRef: Ref<HTMLInputElement | null>
  effortDetailAnchorRef: Ref<HTMLElement | null>
  progressRateDraft: Ref<string>
  progressRateSaving: Ref<boolean>
  progressRateInputRef: Ref<HTMLInputElement | null>
  progressRateDetailAnchorRef: Ref<HTMLElement | null>
  labelSearchQuery: Ref<string>
  memberSearchQuery: Ref<string>
  calendarCursor: Ref<Date>
  ignoreOverlayCloseUntil: Ref<number>
  popoverStyle: Ref<Record<string, string>>
  popoverAnchorEl: Ref<HTMLElement | null>
  activePopover: Ref<string | null>
  normalizeTaskDetail: (detail: TaskDetail) => TaskDetail
  hydrateChecklists: (items: TaskChecklist[]) => void
  resetChecklists: () => void
  resetAttachments: () => void
  applyInitialAttachments: (items: TaskAttachmentItem[]) => void
  loadAttachments: () => void | Promise<void>
  adjustTitleTextareaHeight: () => void
  adjustDescriptionTextareaHeight: () => void
  dismissPopover: () => void
  fetchParentTasks: () => Promise<void>
  onMissing?: () => void
}) {
  const { api } = useApi()
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  function resetInteractionState () {
    options.resetChecklists()
    options.saving.value = false
    options.dateSaving.value = false
    options.saveError.value = null
    options.dismissPopover()
    options.ignoreOverlayCloseUntil.value = 0
    options.popoverStyle.value = popoverPositionVisibilityStyle(false)
    options.popoverAnchorEl.value = null
    options.calendarCursor.value = new Date()
    options.titleComposing.value = false
    options.titleSaving.value = false
    options.descriptionSaving.value = false
    options.labelSearchQuery.value = ''
    options.memberSearchQuery.value = ''
    options.effortDraft.value = ''
    options.effortSaving.value = false
    options.effortInputRef.value = null
    options.effortDetailAnchorRef.value = null
    options.progressRateDraft.value = ''
    options.progressRateSaving.value = false
    options.progressRateInputRef.value = null
    options.progressRateDetailAnchorRef.value = null
    options.listSaving.value = false
    options.parentSaving.value = false
    options.pickerMutationPending.value = false
  }

  function applyLoadedTask (
    detail: TaskDetail,
    parentTasksList?: ParentTaskOption[] | null,
  ) {
    options.task.value = options.normalizeTaskDetail(detail)
    options.hydrateChecklists(options.task.value.checklists ?? [])
    options.titleDraft.value = options.task.value.title
    options.descriptionDraft.value = options.task.value.description ?? ''
    if (parentTasksList != null) {
      options.parentTasks.value = parentTasksList
      options.parentTasksLoading.value = false
    }
    loading.value = false
    loadError.value = null
    nextTick(() => {
      options.adjustTitleTextareaHeight()
      options.adjustDescriptionTextareaHeight()
    })
  }

  function resetState () {
    options.resetChecklists()
    options.task.value = null
    loading.value = false
    options.saving.value = false
    options.dateSaving.value = false
    loadError.value = null
    options.saveError.value = null
    options.dismissPopover()
    options.ignoreOverlayCloseUntil.value = 0
    options.popoverStyle.value = popoverPositionVisibilityStyle(false)
    options.popoverAnchorEl.value = null
    options.calendarCursor.value = new Date()
    options.titleDraft.value = ''
    options.titleComposing.value = false
    options.titleSaving.value = false
    options.descriptionTextareaRef.value = null
    options.descriptionDraft.value = ''
    options.descriptionSaving.value = false
    options.labelSearchQuery.value = ''
    options.memberSearchQuery.value = ''
    options.effortDraft.value = ''
    options.effortSaving.value = false
    options.effortInputRef.value = null
    options.effortDetailAnchorRef.value = null
    options.progressRateDraft.value = ''
    options.progressRateSaving.value = false
    options.progressRateInputRef.value = null
    options.progressRateDetailAnchorRef.value = null
    options.parentTasks.value = []
    options.parentTasksLoading.value = false
    options.listSaving.value = false
    options.pickerMutationPending.value = false
    options.isNavigatingFade.value = false
    options.resetAttachments()
  }

  async function loadTask () {
    const id = toValue(options.taskId)
    if (id === null) return
    loading.value = true
    loadError.value = null
    try {
      await fetchAndApplyTaskDetail()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '読み込みに失敗しました'
      if (isAccessDeniedMessage(message)) {
        loading.value = false
        options.onMissing?.()
        return
      }
      loadError.value = message
      loading.value = false
    }
  }

  async function fetchAndApplyTaskDetail () {
    const id = toValue(options.taskId)
    if (id === null) return
    const detail = await api<TaskDetail>(
      `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${id}`,
    )
    if (toValue(options.taskId) !== detail.id) return
    const initialParents = toValue(options.initialParentTasks)
    if (initialParents == null) {
      await options.fetchParentTasks()
    }
    applyLoadedTask(detail, initialParents)
  }

  async function refreshTaskDetailSilently () {
    if (toValue(options.taskId) === null) return
    try {
      await fetchAndApplyTaskDetail()
    } catch {
      // ボードの初期表示を維持する
    }
  }

  async function reload () {
    await loadTask()
  }

  function applyRemoteTaskPatch (patch: TaskDetailRemotePatch) {
    if (!options.task.value || patch.id !== options.task.value.id) {
      return
    }
    if (
      loading.value
      || options.titleSaving.value
      || options.descriptionSaving.value
      || options.saving.value
      || options.dateSaving.value
      || options.effortSaving.value
      || options.progressRateSaving.value
      || options.listSaving.value
      || options.parentSaving.value
      || options.checklistSaving.value
      || options.activePopover.value === 'effort'
      || options.activePopover.value === 'progress-rate'
    ) {
      return
    }
    const current = options.task.value
    const merged = options.normalizeTaskDetail({
      ...current,
      ...patch,
      labels: patch.labels ?? current.labels,
      assignees: patch.assignees ?? current.assignees,
    })
    const unchanged = (
      merged.title === current.title
      && (merged.description ?? null) === (current.description ?? null)
      && merged.list_id === current.list_id
      && (merged.sort_order ?? null) === (current.sort_order ?? null)
      && (merged.start_date ?? null) === (current.start_date ?? null)
      && (merged.due_date ?? null) === (current.due_date ?? null)
      && (merged.effort_hours ?? null) === (current.effort_hours ?? null)
      && (merged.progress_rate ?? null) === (current.progress_rate ?? null)
      && (merged.parent_task_id ?? null) === (current.parent_task_id ?? null)
      && Boolean(merged.is_parent_task) === Boolean(current.is_parent_task)
      && JSON.stringify(merged.labels) === JSON.stringify(current.labels)
      && JSON.stringify(merged.assignees) === JSON.stringify(current.assignees)
      && patch.checklists === undefined
    )
    if (unchanged) {
      return
    }
    const titleDirty = options.titleDraft.value.trim() !== (current.title ?? '').trim()
    const descDirty = options.descriptionDraft.value !== (current.description ?? '')
    options.task.value = merged
    if (patch.checklists !== undefined) {
      options.checklists.value = patch.checklists
    }
    if (!titleDirty) {
      options.titleDraft.value = options.task.value.title
    }
    if (!descDirty) {
      options.descriptionDraft.value = options.task.value.description ?? ''
      nextTick(() => options.adjustDescriptionTextareaHeight())
    }
  }

  watch(
    () => toValue(options.remoteUpdateRev),
    () => {
      const patch = toValue(options.remoteUpdate)
      if (!patch || !toValue(options.modelValue)) {
        return
      }
      applyRemoteTaskPatch(patch)
    },
  )

  watch(
    () => [toValue(options.modelValue), toValue(options.taskId)] as const,
    async ([open, id], prev) => {
      const prevOpen = prev?.[0] ?? false
      const prevId = prev?.[1] ?? null
      if (!open) {
        // 閉じる瞬間に中身を消すと leave フェードが空カードになるため after-leave で reset
        return
      }
      if (id === null) return
      if (prevOpen && prevId === id) return
      const initial = toValue(options.initialTaskDetail)
      const seedAttachments = () => {
        const seeded = toValue(options.initialAttachments)
        if (seeded != null) {
          options.applyInitialAttachments(seeded)
          return
        }
        void options.loadAttachments()
      }
      if (initial && initial.id === id) {
        resetInteractionState()
        applyLoadedTask(initial, toValue(options.initialParentTasks))
        void refreshTaskDetailSilently()
        seedAttachments()
        return
      }
      resetState()
      await loadTask()
      seedAttachments()
    },
    { immediate: true },
  )

  function onModalAfterLeave () {
    if (!toValue(options.modelValue)) {
      resetState()
    }
  }

  return {
    loading,
    loadError,
    resetInteractionState,
    applyLoadedTask,
    resetState,
    loadTask,
    fetchAndApplyTaskDetail,
    refreshTaskDetailSilently,
    reload,
    applyRemoteTaskPatch,
    onModalAfterLeave,
  }
}
