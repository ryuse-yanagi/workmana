import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'
import { useExclusivePopover } from './useExclusivePopover'
import { useDropdownEscapeClose } from './useDropdownEscapeClose'
import {
  POPOVER_VIEWPORT_INSET,
  measurePopoverNaturalHeight,
  popoverMaxHeightStyle,
  popoverPositionVisibilityStyle,
  popoverScrollbarGutterStyle,
  popoverWidthExtraForGutter,
  resolveFlippedPopoverVerticalLayout,
  resolvePopoverScrollbarGutter,
  schedulePopoverOpenLayout,
} from '../../utils/ui/popoverScrollbar'

export type AnchoredFilterPopoverPosition = {
  top: number
  left: number
  maxHeight: number
  scrollbarGutter: number
}

/**
 * ボード / WBS / スペース一覧で共有する右上アンカー型フィルターポップオーバー。
 */
export function useAnchoredFilterPopover (options: {
  triggerRef: Ref<HTMLElement | null>
  dropdownRef: Ref<{ rootRef?: HTMLElement | null } | null | undefined>
  baseWidth?: number
  bottomOffset?: number
  /** open 前に他メニューを閉じるなど */
  onBeforeOpen?: () => void
  /** close 時に検索クエリをクリアするなど */
  onClose?: () => void
  /** 内容変化で再配置する検索クエリ等 */
  repositionSources?: Array<Ref<unknown>>
  useEscapeClose?: boolean
}) {
  const baseWidth = options.baseWidth ?? 384
  const bottomOffset = options.bottomOffset ?? POPOVER_VIEWPORT_INSET
  const useEscapeClose = options.useEscapeClose ?? true

  const open = ref(false)
  const position = ref<AnchoredFilterPopoverPosition | null>(null)
  const layoutSettled = ref(false)

  const style = computed(() => {
    if (!position.value) {
      return {
        position: 'fixed' as const,
        zIndex: 1000,
        ...popoverPositionVisibilityStyle(false),
      }
    }
    const { top, left, maxHeight, scrollbarGutter } = position.value
    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${baseWidth + popoverWidthExtraForGutter(scrollbarGutter)}px`,
      zIndex: 1000,
      ...popoverPositionVisibilityStyle(layoutSettled.value),
      ...popoverMaxHeightStyle(maxHeight, scrollbarGutter),
      ...popoverScrollbarGutterStyle(scrollbarGutter),
    }
  })

  function isTriggerAvailable (anchor?: HTMLElement | null): boolean {
    const el = anchor ?? options.triggerRef.value
    if (!el || !el.isConnected || !import.meta.client) {
      return false
    }
    const computedStyle = getComputedStyle(el)
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return false
    }
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function positionPopover () {
    const anchor = options.triggerRef.value
    if (!anchor || !import.meta.client) {
      position.value = null
      return
    }
    const rect = anchor.getBoundingClientRect()
    const pad = POPOVER_VIEWPORT_INSET
    const gap = 6
    const preferredTop = Math.max(pad, rect.bottom + gap)
    const el = options.dropdownRef.value?.rootRef ?? null
    const measuredHeight = el ? measurePopoverNaturalHeight(el) : 0
    const vertical = resolveFlippedPopoverVerticalLayout(preferredTop, {
      pad: bottomOffset,
      contentHeight: measuredHeight,
    })
    const maxHeight = vertical.maxHeight
    const scrollbarGutter = el
      ? resolvePopoverScrollbarGutter(el, maxHeight)
      : 0
    const width = baseWidth + popoverWidthExtraForGutter(scrollbarGutter)
    const left = Math.max(pad, window.innerWidth - width - pad)
    position.value = {
      top: vertical.top,
      left,
      maxHeight,
      scrollbarGutter,
    }
  }

  function close () {
    if (!open.value) {
      return
    }
    open.value = false
    options.onClose?.()
  }

  function onAfterLeave () {
    layoutSettled.value = false
    position.value = null
  }

  function openPopover (anchor?: HTMLElement | null) {
    if (anchor) {
      options.triggerRef.value = anchor
    }
    if (open.value) {
      return
    }
    if (!isTriggerAvailable(anchor)) {
      return
    }
    options.onBeforeOpen?.()
    layoutSettled.value = false
    open.value = true
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionPopover(),
        () => {
          layoutSettled.value = true
        },
      )
    })
  }

  function toggle (anchor?: HTMLElement | null) {
    if (anchor) {
      options.triggerRef.value = anchor
    }
    if (open.value) {
      close()
      return
    }
    openPopover(anchor)
  }

  function onSectionToggle () {
    if (!open.value) {
      return
    }
    nextTick(() => {
      positionPopover()
      requestAnimationFrame(() => positionPopover())
    })
  }

  useExclusivePopover(open, close)
  if (useEscapeClose) {
    useDropdownEscapeClose(open, close)
  }

  if (options.repositionSources?.length) {
    watch(options.repositionSources, () => {
      if (!open.value) {
        return
      }
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
    })
  }

  if (import.meta.client) {
    useEventListener(window, 'resize', () => {
      if (!open.value) {
        return
      }
      positionPopover()
    })
  }

  return {
    open,
    position,
    layoutSettled,
    style,
    isTriggerAvailable,
    positionPopover,
    close,
    openPopover,
    toggle,
    onAfterLeave,
    onSectionToggle,
  }
}
