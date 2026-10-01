import type { MaybeRefOrGetter } from 'vue'
import { onBeforeUnmount, toValue, watch } from 'vue'

let modalLayerCount = 0

const FLOATING_Z_VAR = '--wm-z-floating'
const POPOVER_LAYER = 'var(--wm-z-popover)'
const MODAL_POPOVER_LAYER = 'var(--wm-z-modal-popover)'

/** モーダルが開いているあいだ、浮動 UI の z-index をモーダルより前へ上げる。 */
export function syncModalFloatingZIndex (): void {
  if (!import.meta.client) {
    return
  }
  document.documentElement.style.setProperty(
    FLOATING_Z_VAR,
    modalLayerCount > 0 ? MODAL_POPOVER_LAYER : POPOVER_LAYER,
  )
}

export function registerModalLayer (): void {
  modalLayerCount += 1
  syncModalFloatingZIndex()
}

export function unregisterModalLayer (): void {
  modalLayerCount = Math.max(0, modalLayerCount - 1)
  syncModalFloatingZIndex()
}

/** モーダル表示中は body 直下のポップオーバー等をモーダルより前面に出す */
export function useModalLayer (isOpen: MaybeRefOrGetter<boolean>): void {
  if (!import.meta.client) {
    return
  }

  let registered = false

  function register (): void {
    if (registered) {
      return
    }
    registered = true
    registerModalLayer()
  }

  function unregister (): void {
    if (!registered) {
      return
    }
    registered = false
    unregisterModalLayer()
  }

  watch(
    () => toValue(isOpen),
    (open) => {
      if (open) {
        register()
      } else {
        unregister()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(unregister)
}
