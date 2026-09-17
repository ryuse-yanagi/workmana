import type { Ref } from 'vue'
import { useDropdownEscapeClose } from './useDropdownEscapeClose'
import { useExclusivePopover } from './useExclusivePopover'
import {
  dismissPopoverFromOutsidePointer,
  isInsideFloatingPopover,
  isScrollInsideRoot,
} from '../utils/uiInteraction'

/**
 * NamedPillSelect / WorkspaceAssigneeSelect などで共有する
 * 外側クリック・リサイズ・スクロール時の閉じ／再配置。
 */
export function useAnchoredDropdownDismiss (options: {
  isOpen: Ref<boolean>
  close: () => void
  position: () => void
  triggerRef: Ref<HTMLElement | null>
  getDropdownEl: () => HTMLElement | null | undefined
  exclusive?: boolean
  escapeClose?: boolean
}) {
  const exclusive = options.exclusive ?? true
  const escapeClose = options.escapeClose ?? true

  function isTriggerVisible (): boolean {
    const trigger = options.triggerRef.value
    if (!trigger) {
      return false
    }
    return trigger.getClientRects().length > 0
  }

  function shouldIgnoreOutsidePointer (target: Node): boolean {
    if (options.triggerRef.value?.contains(target)) {
      return true
    }
    const dropdownEl = options.getDropdownEl()
    if (dropdownEl?.contains(target)) {
      return true
    }
    return false
  }

  function onDocumentPointerUp (event: PointerEvent) {
    if (!options.isOpen.value || event.button !== 0) {
      return
    }
    const target = event.target
    if (!(target instanceof Node)) {
      options.close()
      return
    }
    if (shouldIgnoreOutsidePointer(target)) {
      return
    }
    if (isInsideFloatingPopover(target)) {
      return
    }
    dismissPopoverFromOutsidePointer(target, options.close)
  }

  function onWindowResize () {
    if (!options.isOpen.value) {
      return
    }
    options.position()
  }

  function onWindowScroll (event: Event) {
    if (!options.isOpen.value) {
      return
    }
    if (isScrollInsideRoot(event, options.getDropdownEl() ?? null)) {
      return
    }
    if (!isTriggerVisible()) {
      options.close()
      return
    }
    options.position()
  }

  function bindGlobalListeners () {
    if (!import.meta.client) {
      return
    }
    document.addEventListener('pointerup', onDocumentPointerUp, true)
    window.addEventListener('resize', onWindowResize)
    window.addEventListener('scroll', onWindowScroll, true)
  }

  function unbindGlobalListeners () {
    if (!import.meta.client) {
      return
    }
    document.removeEventListener('pointerup', onDocumentPointerUp, true)
    window.removeEventListener('resize', onWindowResize)
    window.removeEventListener('scroll', onWindowScroll, true)
  }

  watch(options.isOpen, (open) => {
    unbindGlobalListeners()
    if (!open) {
      return
    }
    nextTick(() => {
      if (!options.isOpen.value) {
        return
      }
      if (!isTriggerVisible()) {
        options.close()
        return
      }
      bindGlobalListeners()
    })
  })

  onBeforeUnmount(unbindGlobalListeners)

  if (escapeClose) {
    useDropdownEscapeClose(options.isOpen, options.close)
  }
  if (exclusive) {
    useExclusivePopover(options.isOpen, options.close)
  }

  return {
    isTriggerVisible,
    bindGlobalListeners,
    unbindGlobalListeners,
  }
}
