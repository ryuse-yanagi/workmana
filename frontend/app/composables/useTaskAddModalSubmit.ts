import type { Ref } from 'vue'
import {
  applyTaskDefaultsToDraft,
  buildTaskAddBody,
  clearTaskDraftDefaults,
  createEmptyTaskFormDraft,
  taskDraftHasLinkedDefaults,
  type TaskFormDefaultsSource,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from './useTaskFormHelpers'
import { taskTitleFieldError } from '../utils/formValidation'
import { useApi } from './useApi'
import type { AddedTask, TaskAddModalProps } from './useTaskAddModal'

type ParentTaskDetail = {
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  progress_rate: number | string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}

type TaskFormPaneExpose = {
  resetPaneState: () => void
}

type TaskAddModalEmit = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'added', task: AddedTask): void
}

type UseTaskAddModalSubmitOptions = {
  props: TaskAddModalProps
  emit: TaskAddModalEmit
  draft: Ref<TaskFormDraft>
  createAsParent: Ref<boolean>
  parentTaskId: Ref<number | null>
  selectedListId: Ref<number | null>
  parentTasks: Ref<{ id: number; title: string }[]>
  parentTasksFetched: Ref<boolean>
  parentTaskDefaultsLoading: Ref<boolean>
  submitting: Ref<boolean>
  submitError: Ref<string | null>
  titleError: Ref<string | null>
  parentPickerError: Ref<string | null>
  listPickerError: Ref<string | null>
  taskFormPaneRef: Ref<TaskFormPaneExpose | null>
  closeParentPicker: () => void
  closeListPicker: () => void
  /** resetForm で先読み適用した直後の watch(parentTaskId) を一度だけ無視する */
  getIgnoreParentDefaultsWatch: () => boolean
  setIgnoreParentDefaultsWatch: (value: boolean) => void
  getParentDefaultsApplied: () => boolean
  setParentDefaultsApplied: (value: boolean) => void
}

/**
 * タスク追加モーダルの submit / reset / 親デフォルト適用。
 * オープン・ピッカー編成は useTaskAddModal 側に残す。
 */
export function useTaskAddModalSubmit (options: UseTaskAddModalSubmitOptions) {
  const { api } = useApi()
  let parentDefaultsRequestId = 0

  async function applyParentTaskDefaults (parentId: number | null) {
    if (options.createAsParent.value) return
    const requestId = ++parentDefaultsRequestId
    if (parentId === null) {
      if (options.getParentDefaultsApplied()) {
        options.draft.value = clearTaskDraftDefaults(options.draft.value)
        options.setParentDefaultsApplied(false)
        nextTick(() => {
          options.taskFormPaneRef.value?.resetPaneState()
        })
      }
      return
    }
    // 期間・担当者など、すでに何か設定済みなら親の値で上書きしない
    if (taskDraftHasLinkedDefaults(options.draft.value)) {
      return
    }
    options.parentTaskDefaultsLoading.value = true
    options.submitError.value = null
    try {
      const detail = await api<ParentTaskDetail>(
        `/orgs/${options.props.orgSlug}/workspaces/${options.props.workspaceId}/tasks/${parentId}`,
      )
      if (requestId !== parentDefaultsRequestId) return
      if (taskDraftHasLinkedDefaults(options.draft.value)) {
        return
      }
      options.draft.value = applyTaskDefaultsToDraft(options.draft.value, detail)
      options.setParentDefaultsApplied(true)
      nextTick(() => {
        options.taskFormPaneRef.value?.resetPaneState()
      })
    } catch (e: unknown) {
      if (requestId !== parentDefaultsRequestId) return
      options.parentPickerError.value = e instanceof Error ? e.message : '親タスクの情報取得に失敗しました'
    } finally {
      if (requestId === parentDefaultsRequestId) {
        options.parentTaskDefaultsLoading.value = false
      }
    }
  }

  function resetForm () {
    options.draft.value = createEmptyTaskFormDraft()
    options.createAsParent.value = false
    options.selectedListId.value = options.props.listId
    options.parentTasks.value = []
    options.parentTasksFetched.value = false
    options.parentTaskDefaultsLoading.value = false
    options.setParentDefaultsApplied(false)
    options.submitError.value = null
    options.titleError.value = null
    options.parentPickerError.value = null
    options.listPickerError.value = null
    options.closeParentPicker()
    options.closeListPicker()
    const initialParentId = options.props.initialParentTaskId ?? null
    const prefetched = initialParentId != null ? options.props.initialParentDefaults : null
    if (prefetched) {
      options.setIgnoreParentDefaultsWatch(options.parentTaskId.value !== initialParentId)
      options.parentTaskId.value = initialParentId
      options.draft.value = applyTaskDefaultsToDraft(options.draft.value, prefetched as TaskFormDefaultsSource)
      options.setParentDefaultsApplied(true)
      nextTick(() => {
        options.taskFormPaneRef.value?.resetPaneState()
      })
      return
    }
    // 同じ親IDで再オープンすると watch(parentTaskId) が発火しないため、明示適用する
    const parentUnchanged = options.parentTaskId.value === initialParentId
    options.parentTaskId.value = initialParentId
    if (parentUnchanged) {
      void applyParentTaskDefaults(initialParentId)
    }
  }

  async function submit () {
    if (options.submitting.value) return
    const validationError = taskTitleFieldError(options.draft.value.title)
    if (validationError) {
      options.titleError.value = validationError
      return
    }
    if (options.selectedListId.value === null) {
      options.submitError.value = 'リストが選択されていません'
      return
    }
    options.titleError.value = null
    options.submitting.value = true
    options.submitError.value = null
    try {
      const body = buildTaskAddBody(options.draft.value, {
        listId: options.selectedListId.value,
        createAsParent: options.createAsParent.value,
        parentTaskId: options.parentTaskId.value,
      })
      const added = await api<AddedTask>(
        `/orgs/${options.props.orgSlug}/workspaces/${options.props.workspaceId}/tasks`,
        { method: 'POST', body },
      )
      options.emit('added', added)
      options.emit('update:modelValue', false)
    } catch (e: unknown) {
      options.submitError.value = e instanceof Error ? e.message : '追加に失敗しました'
    } finally {
      options.submitting.value = false
    }
  }

  watch(options.createAsParent, (enabled) => {
    options.closeParentPicker()
    if (enabled) {
      options.parentTaskId.value = null
      if (options.getParentDefaultsApplied()) {
        options.draft.value = clearTaskDraftDefaults(options.draft.value)
        options.setParentDefaultsApplied(false)
      }
      nextTick(() => {
        options.taskFormPaneRef.value?.resetPaneState()
      })
    }
  })

  watch(options.parentTaskId, (parentId) => {
    if (options.getIgnoreParentDefaultsWatch()) {
      options.setIgnoreParentDefaultsWatch(false)
      return
    }
    void applyParentTaskDefaults(parentId)
  })

  watch(
    () => options.draft.value.title,
    () => {
      if (options.titleError.value) {
        options.titleError.value = null
      }
    },
  )

  return {
    submit,
    resetForm,
    applyParentTaskDefaults,
  }
}
