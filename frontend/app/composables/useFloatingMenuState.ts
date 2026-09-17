import type { CSSProperties } from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  POPOVER_VIEWPORT_INSET,
  clampPopoverBox,
  resolveMeasuredFloatingMenuHeight,
} from '../utils/popoverScrollbar'
import { useDropdownEscapeClose } from './useDropdownEscapeClose'

export type FloatingMenuPlacement = 'beside' | 'below-end'

/**
 * カード / リスト / サブヘッダー等で共有する浮動メニューの開閉・配置状態。
 * pending 切替（別メニューへ after-leave 後に開き直す）も扱う。
 */
export function useFloatingMenuState<TId extends string | number> (options: {
  menuMinWidth: number
  getMenuItemCount: () => number
  placement?: FloatingMenuPlacement
  gap?: number
  zIndex?: number | string
  /** true なら minWidth の代わりに width を固定 */
  fixedWidth?: boolean
  /** 別メニューを閉じるなど、開く直前の副作用 */
  onBeforeOpen?: () => void
  /** リサイズで閉じる（詳細モーダル内メニュー向け） */
  closeOnWindowResize?: boolean
  /** Escape で閉じる */
  escapeClose?: boolean
}) {
  const placement = options.placement ?? 'beside'
  const gap = options.gap ?? 6
  const zIndex = options.zIndex ?? 1000

  const openId = ref<TId | null>(null)
  const position = ref<{ top: number; left: number } | null>(null)
  const pendingOpen = ref<{ id: TId; anchor: HTMLElement } | null>(null)

  const style = computed((): CSSProperties | undefined => {
    if (!position.value) {
      return placement === 'beside' ? {} : undefined
    }
    const { top, left } = position.value
    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      ...(options.fixedWidth
        ? { width: `${options.menuMinWidth}px` }
        : { minWidth: `${options.menuMinWidth}px` }),
      zIndex,
    }
  })

  const isOpen = computed(() => openId.value != null)

  function close () {
    pendingOpen.value = null
    openId.value = null
  }

  function clearPositionIfIdle () {
    if (openId.value == null && pendingOpen.value == null) {
      position.value = null
    }
  }

  function positionMenu (anchor: HTMLElement) {
    if (!import.meta.client) {
      position.value = { top: 0, left: 0 }
      return
    }
    const rect = anchor.getBoundingClientRect()
    const pad = POPOVER_VIEWPORT_INSET
    const menuWidth = options.menuMinWidth
    const menuHeight = resolveMeasuredFloatingMenuHeight(options.getMenuItemCount())
    if (placement === 'below-end') {
      let left = rect.right - menuWidth
      left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad))
      position.value = clampPopoverBox(rect.bottom + gap, left, menuWidth, menuHeight, pad)
      return
    }
    let left = rect.right + gap
    const maxLeft = window.innerWidth - menuWidth - pad
    if (left > maxLeft) {
      left = Math.max(pad, rect.left - menuWidth - gap)
    }
    position.value = clampPopoverBox(rect.top, left, menuWidth, menuHeight, pad)
  }

  function open (id: TId, anchor: HTMLElement) {
    if (openId.value === id) {
      close()
      return
    }
    options.onBeforeOpen?.()
    if (openId.value != null) {
      pendingOpen.value = { id, anchor }
      openId.value = null
      return
    }
    positionMenu(anchor)
    openId.value = id
    nextTick(() => {
      if (openId.value === id) {
        positionMenu(anchor)
      }
    })
  }

  function toggle (id: TId, event: MouseEvent) {
    const el = event.currentTarget
    if (!(el instanceof HTMLElement)) {
      return
    }
    open(id, el)
  }

  function onAfterLeave () {
    const pending = pendingOpen.value
    if (!pending) {
      position.value = null
      return
    }
    pendingOpen.value = null
    positionMenu(pending.anchor)
    openId.value = pending.id
    nextTick(() => {
      if (openId.value === pending.id) {
        positionMenu(pending.anchor)
      }
    })
  }

  function openFromContextMenu (
    id: TId,
    event: MouseEvent,
    triggerSelector = '.card-menu-trigger',
    opts?: { preventDefault?: boolean },
  ) {
    event.stopPropagation()
    if (opts?.preventDefault) {
      event.preventDefault()
    }
    const card = event.currentTarget
    if (!(card instanceof HTMLElement)) {
      return
    }
    const trigger = card.querySelector(triggerSelector)
    if (!(trigger instanceof HTMLElement)) {
      return
    }
    open(id, trigger)
  }

  if (options.escapeClose) {
    useDropdownEscapeClose(isOpen, close)
  }

  if (options.closeOnWindowResize && import.meta.client) {
    useEventListener(window, 'resize', () => {
      if (isOpen.value) {
        close()
      }
    })
  }

  return {
    openId,
    position,
    pendingOpen,
    style,
    isOpen,
    close,
    clearPositionIfIdle,
    positionMenu,
    open,
    toggle,
    onAfterLeave,
    openFromContextMenu,
  }
}
