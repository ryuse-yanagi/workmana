import type { Ref } from 'vue'
import type { TaskFormDraft } from './useTaskFormHelpers'
import { dismissExclusivePopoverBeforeModalClose } from '../utils/uiInteraction'

type FormPaneExpose = {
  resetPaneState: () => void
  focusTitleInput?: () => void
  activePopover?: unknown
  closePopover?: () => void | Promise<void>
}

/**
 * PaneEntityFormModal + TaskFormPane 系の共通ライフサイクル
 *（下書きリセット、背景クリック、タイトルエラー解除、setSubmitError）。
 */
export function usePaneEntityFormLifecycle (options: {
  modelValue: Ref<boolean> | (() => boolean)
  loading: Ref<boolean> | (() => boolean)
  draft: Ref<TaskFormDraft>
  formPaneRef: Ref<FormPaneExpose | null>
  /** open 時に呼ぶ下書き生成 */
  buildDraft: () => TaskFormDraft
  /** 閉じるときに popover を閉じる監視ソース（mode / initialValues 等） */
  resetWatchSources?: () => unknown
}) {
  const submitError = ref<string | null>(null)
  const titleError = ref<string | null>(null)

  const panePopoverOpen = computed(() => options.formPaneRef.value?.activePopover != null)

  function readOpen (): boolean {
    const source = options.modelValue
    return typeof source === 'function' ? source() : source.value
  }

  function readLoading (): boolean {
    const source = options.loading
    return typeof source === 'function' ? source() : source.value
  }

  function resetForm () {
    options.draft.value = options.buildDraft()
    submitError.value = null
    titleError.value = null
    nextTick(() => {
      options.formPaneRef.value?.resetPaneState()
    })
  }

  function close (emitClose: () => void) {
    if (readLoading()) return
    emitClose()
  }

  function onBackdropClose (emitClose: () => void) {
    if (readLoading()) return
    if (dismissExclusivePopoverBeforeModalClose()) return
    if (panePopoverOpen.value) {
      void options.formPaneRef.value?.closePopover?.()
      return
    }
    close(emitClose)
  }

  function setSubmitError (message: string) {
    submitError.value = message
  }

  function clearTitleErrorOnEdit () {
    if (titleError.value) {
      titleError.value = null
    }
  }

  watch(
    () => options.draft.value.title,
    clearTitleErrorOnEdit,
  )

  watch(
    () => [
      readOpen(),
      options.resetWatchSources?.(),
    ] as const,
    ([open]) => {
      if (!import.meta.client) return
      if (open) {
        resetForm()
        return
      }
      void options.formPaneRef.value?.closePopover?.()
    },
  )

  return {
    submitError,
    titleError,
    panePopoverOpen,
    resetForm,
    close,
    onBackdropClose,
    setSubmitError,
  }
}
