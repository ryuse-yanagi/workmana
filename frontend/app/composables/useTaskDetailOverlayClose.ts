import type { Ref } from 'vue'
import {
  createOverlayBackdropClose,
  dismissExclusivePopoverBeforeModalClose,
  getTopmostModalOverlay,
} from '../utils/uiInteraction'

type UseTaskDetailOverlayCloseOptions = {
  modelValue: MaybeRefOrGetter<boolean>
  overlayRef: Ref<HTMLElement | null>
  ignoreOverlayCloseUntil: Ref<number>
  isBusy: () => boolean
  getActivePopover: () => unknown
  closePopover: () => void | Promise<void>
  /** 未保存ドラフトの flush。false を返すとモーダルを閉じない */
  flushBeforeClose: () => Promise<boolean>
  onClosed: () => void
}

/**
 * タスク詳細モーダルのオーバーレイ閉じ（guard / Escape / backdrop）。
 * ポップオーバー契約（activePopover 優先・exclusive dismiss）は維持する。
 */
export function useTaskDetailOverlayClose (options: UseTaskDetailOverlayCloseOptions) {
  function armOverlayCloseGuard (ms = 400) {
    options.ignoreOverlayCloseUntil.value = Date.now() + ms
  }

  function isOverlayCloseBlocked (): boolean {
    return Date.now() < options.ignoreOverlayCloseUntil.value
  }

  async function close () {
    if (isOverlayCloseBlocked() || options.isBusy()) return
    if (options.getActivePopover()) {
      void options.closePopover()
      return
    }
    if (dismissExclusivePopoverBeforeModalClose()) {
      return
    }
    if (!(await options.flushBeforeClose())) return
    options.onClosed()
  }

  function onDocumentEscape (event: KeyboardEvent) {
    if (event.key !== 'Escape' || !toValue(options.modelValue)) {
      return
    }
    if (getTopmostModalOverlay() !== options.overlayRef.value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    void close()
  }

  watch(() => toValue(options.modelValue), (open) => {
    if (!import.meta.client) {
      return
    }
    if (open) {
      document.addEventListener('keydown', onDocumentEscape, true)
    } else {
      document.removeEventListener('keydown', onDocumentEscape, true)
    }
  }, { immediate: true })

  const {
    onOverlayMouseDown,
    resetOverlayBackdropClose,
  } = createOverlayBackdropClose({
    onClose: close,
    canClose: () => !isOverlayCloseBlocked() && !options.isBusy(),
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onDocumentEscape, true)
    resetOverlayBackdropClose()
  })

  return {
    armOverlayCloseGuard,
    close,
    onOverlayMouseDown,
    resetOverlayBackdropClose,
    isOverlayCloseBlocked,
  }
}
