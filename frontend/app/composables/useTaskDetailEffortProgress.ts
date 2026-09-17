import type { Ref } from 'vue'
import type { TaskDetail } from '../components/modals/TaskDetailModal.vue'
import { useApi } from './useApi'
import {
  formatEffortAmount,
  formatEffortDisplay,
  formatProgressRateDisplay,
  normalizeEffortHours,
  normalizeProgressRate,
  parseEffortDraft,
  parseProgressRateDraft,
  progressRateValueToDraft,
  resolveStoredEffortValue,
  resolveStoredProgressRate,
  sanitizeEffortDraftInput,
  sanitizeProgressRateDraftInput,
} from './useTaskFormHelpers'

/**
 * タスク詳細の工数／進捗率ドラフトと PATCH 保存。
 * ポップオーバー開閉は SFC 側に残す。
 */
export function useTaskDetailEffortProgress (options: {
  task: Ref<TaskDetail | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  taskId: MaybeRefOrGetter<number | null>
  saving: Ref<boolean>
  saveError: Ref<string | null>
  popoverError: Ref<string | null>
  isStillShowingTask: (requestTaskId: number) => boolean
  applyUpdatedTaskIfCurrent: (requestTaskId: number, updated: TaskDetail) => boolean
  resolveEffortInputEl: () => HTMLInputElement | null
  resolveProgressRateInputEl: () => HTMLInputElement | null
  onUpdated?: (detail: TaskDetail) => void
}) {
  const { api } = useApi()
  const effortDraft = ref<string | number>('')
  const effortSaving = ref(false)
  const progressRateDraft = ref<string | number>('')
  const progressRateSaving = ref(false)

  const canClearEffort = computed(() => String(effortDraft.value ?? '').trim() !== '')
  const canClearProgressRate = computed(() => String(progressRateDraft.value ?? '').trim() !== '')

  function resolveStoredEffortValueForTask (detail: TaskDetail): number | null {
    return resolveStoredEffortValue({
      effort_hours: detail.effort_hours ?? null,
    })
  }

  function effortValueToDraftFromTask (detail: TaskDetail): string {
    const value = resolveStoredEffortValueForTask(detail)
    if (value === null) {
      return ''
    }
    return formatEffortAmount(value)
  }

  function formatEffortDisplayForTask (detail: TaskDetail): string {
    return formatEffortDisplay({
      effort_hours: detail.effort_hours ?? null,
    })
  }

  function resolveStoredProgressRateForTask (detail: TaskDetail): number | null {
    return resolveStoredProgressRate({
      progress_rate: detail.progress_rate ?? null,
    })
  }

  function progressRateValueToDraftFromTask (detail: TaskDetail): string {
    return progressRateValueToDraft({
      progress_rate: detail.progress_rate ?? null,
    })
  }

  function formatProgressRateDisplayForTask (detail: TaskDetail): string {
    return formatProgressRateDisplay({
      progress_rate: detail.progress_rate ?? null,
    })
  }

  function updateEffortDraft (raw: string | number) {
    const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
    effortDraft.value = sanitized
    const inputEl = options.resolveEffortInputEl()
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }

  function updateProgressRateDraft (raw: string | number) {
    const sanitized = sanitizeProgressRateDraftInput(String(raw ?? ''))
    progressRateDraft.value = sanitized
    const inputEl = options.resolveProgressRateInputEl()
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }

  async function saveEffort (): Promise<boolean> {
    if (!options.task.value || effortSaving.value) return false
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '工数は0以上の数値で入力してください'
      effortDraft.value = effortValueToDraftFromTask(options.task.value)
      return false
    }
    const effortHours = parsed === null ? null : normalizeEffortHours(parsed)
    const currentValue = resolveStoredEffortValueForTask(options.task.value)
    if (effortHours === currentValue) {
      options.popoverError.value = null
      return true
    }
    const requestTaskId = options.task.value.id
    const previousHours = options.task.value.effort_hours ?? null
    options.task.value = {
      ...options.task.value,
      effort_hours: effortHours,
    }
    effortSaving.value = true
    options.popoverError.value = null
    options.saveError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { effort_hours: effortHours } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return false
      effortDraft.value = effortValueToDraftFromTask(options.task.value)
      options.onUpdated?.(options.task.value)
      return true
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return false
      options.task.value = {
        ...options.task.value,
        effort_hours: previousHours,
      }
      effortDraft.value = effortValueToDraftFromTask(options.task.value)
      const message = e instanceof Error ? e.message : '工数の更新に失敗しました'
      options.popoverError.value = message
      options.saveError.value = message
      return false
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        effortSaving.value = false
      }
    }
  }

  async function saveProgressRate (): Promise<boolean> {
    if (!options.task.value || progressRateSaving.value) return false
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '進捗率は0〜100の整数で入力してください'
      progressRateDraft.value = progressRateValueToDraftFromTask(options.task.value)
      return false
    }
    const progressRate = parsed === null ? null : normalizeProgressRate(parsed)
    const currentValue = resolveStoredProgressRateForTask(options.task.value)
    if (progressRate === currentValue) {
      options.popoverError.value = null
      return true
    }
    const requestTaskId = options.task.value.id
    const previousRate = options.task.value.progress_rate ?? null
    options.task.value = {
      ...options.task.value,
      progress_rate: progressRate,
    }
    progressRateSaving.value = true
    options.popoverError.value = null
    options.saveError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { progress_rate: progressRate } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return false
      progressRateDraft.value = progressRateValueToDraftFromTask(options.task.value)
      options.onUpdated?.(options.task.value)
      return true
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return false
      options.task.value = {
        ...options.task.value,
        progress_rate: previousRate,
      }
      progressRateDraft.value = progressRateValueToDraftFromTask(options.task.value)
      const message = e instanceof Error ? e.message : '進捗率の更新に失敗しました'
      options.popoverError.value = message
      options.saveError.value = message
      return false
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        progressRateSaving.value = false
      }
    }
  }

  async function clearEffort () {
    if (!options.task.value || effortSaving.value || options.saving.value) return
    effortDraft.value = ''
    options.popoverError.value = null
    const inputEl = options.resolveEffortInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    await saveEffort()
  }

  async function clearProgressRate () {
    if (!options.task.value || progressRateSaving.value || options.saving.value) return
    progressRateDraft.value = ''
    options.popoverError.value = null
    const inputEl = options.resolveProgressRateInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    await saveProgressRate()
  }

  return {
    effortDraft,
    effortSaving,
    progressRateDraft,
    progressRateSaving,
    canClearEffort,
    canClearProgressRate,
    resolveStoredEffortValueForTask,
    effortValueToDraftFromTask,
    formatEffortDisplayForTask,
    resolveStoredProgressRateForTask,
    progressRateValueToDraftFromTask,
    formatProgressRateDisplayForTask,
    updateEffortDraft,
    updateProgressRateDraft,
    saveEffort,
    saveProgressRate,
    clearEffort,
    clearProgressRate,
  }
}
