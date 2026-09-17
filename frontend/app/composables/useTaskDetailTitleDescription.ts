import type { Ref } from 'vue'
import type { TaskDetail } from '../components/modals/TaskDetailModal.vue'
import { useApi } from './useApi'
import { adjustTextareaHeight } from '../utils/textareaAutoGrow'

type TitleFieldExpose = {
  textareaRef?: HTMLTextAreaElement | null
} | null

/**
 * タスク詳細のタイトル／説明ドラフトと PATCH 保存。
 */
export function useTaskDetailTitleDescription (options: {
  task: Ref<TaskDetail | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  taskId: MaybeRefOrGetter<number | null>
  saveError: Ref<string | null>
  isStillShowingTask: (requestTaskId: number) => boolean
  applyUpdatedTaskIfCurrent: (requestTaskId: number, updated: TaskDetail) => boolean
  onUpdated?: (detail: TaskDetail) => void
}) {
  const { api } = useApi()
  const titleDraft = ref('')
  const titleComposing = ref(false)
  const titleSaving = ref(false)
  const titleFieldRef = ref<TitleFieldExpose>(null)
  const titleTextareaRef = computed(() => titleFieldRef.value?.textareaRef ?? null)
  const descriptionDraft = ref('')
  const descriptionSaving = ref(false)
  const descriptionTextareaRef = ref<HTMLTextAreaElement | null>(null)

  const showTitlePlaceholder = computed(() => {
    if (titleComposing.value) return false
    return titleDraft.value.length === 0
  })

  function adjustTitleTextareaHeight () {
    adjustTextareaHeight(titleTextareaRef.value)
  }

  function adjustDescriptionTextareaHeight () {
    adjustTextareaHeight(descriptionTextareaRef.value)
  }

  function revertTitleDraft () {
    if (!options.task.value) return
    titleDraft.value = options.task.value.title
    nextTick(() => adjustTitleTextareaHeight())
  }

  function onTitleEnter () {
    titleDraft.value = titleDraft.value.replace(/\r?\n/g, '').trim()
    titleTextareaRef.value?.blur()
  }

  async function onTitleBlur () {
    await saveTitle()
  }

  async function onDescriptionBlur () {
    await saveDescription()
  }

  async function saveTitle () {
    if (!options.task.value || titleSaving.value) return
    const requestTaskId = options.task.value.id
    const title = titleDraft.value.trim()
    if (!title) {
      titleDraft.value = options.task.value.title
      return
    }
    if (title === options.task.value.title) return
    titleSaving.value = true
    options.saveError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { title } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      titleDraft.value = options.task.value.title
      nextTick(() => adjustTitleTextareaHeight())
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.saveError.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        titleSaving.value = false
      }
    }
  }

  async function saveDescription () {
    if (!options.task.value || descriptionSaving.value) return
    const requestTaskId = options.task.value.id
    const description = descriptionDraft.value
    const normalized = description.trim() === '' ? null : description
    if ((normalized ?? '') === (options.task.value.description ?? '')) return
    descriptionSaving.value = true
    options.saveError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { description: normalized } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      descriptionDraft.value = options.task.value.description ?? ''
      nextTick(() => adjustDescriptionTextareaHeight())
      options.onUpdated?.(options.task.value)
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.saveError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        descriptionSaving.value = false
      }
    }
  }

  watch(titleDraft, () => {
    nextTick(() => adjustTitleTextareaHeight())
  })

  return {
    titleDraft,
    titleComposing,
    titleSaving,
    titleFieldRef,
    titleTextareaRef,
    showTitlePlaceholder,
    descriptionDraft,
    descriptionSaving,
    descriptionTextareaRef,
    adjustTitleTextareaHeight,
    adjustDescriptionTextareaHeight,
    revertTitleDraft,
    onTitleEnter,
    onTitleBlur,
    onDescriptionBlur,
    saveTitle,
    saveDescription,
  }
}
