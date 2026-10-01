import { useEventListener } from '@vueuse/core'
import type { Ref, WatchSource } from 'vue'
import { useExclusivePopover } from '../ui/useExclusivePopover'
import { useDropdownEscapeClose } from '../ui/useDropdownEscapeClose'
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

type ArchivedListPopoverPosition = {
  top: number
  left: number
  maxHeight: number
  scrollbarGutter: number
}

/**
 * アーカイブ一覧ポップオーバーを画面右上（フィルターと同系統）に配置する。
 */
export function useArchivedListPopoverLayout (options: {
  /** 表示中（確認モーダル中も true のまま） */
  isOpen: WatchSource<boolean>
  /** 排他クレーム中。確認モーダル中は false にする */
  isExclusiveOpen?: WatchSource<boolean>
  baseWidth: number | WatchSource<number>
  canClose: () => boolean
  onClose: () => void
  rootRef: Ref<{ rootRef?: HTMLElement | null } | HTMLElement | null | undefined>
}) {
  const position = ref<ArchivedListPopoverPosition | null>(null)
  const layoutSettled = ref(false)
  const panelWidth = computed(() => (
    readBaseWidth() + popoverWidthExtraForGutter(position.value?.scrollbarGutter ?? 0)
  ))

  const style = computed(() => {
    if (!position.value) {
      return {
        position: 'fixed' as const,
        zIndex: 'var(--tm-z-popover)',
        ...popoverPositionVisibilityStyle(false),
      }
    }
    const { top, left, maxHeight, scrollbarGutter } = position.value
    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      // ページ上ポップオーバーはモーダル(--tm-z-modal: 200)より下に固定する。
      // --tm-z-floating はモーダル表示中 210 に上がるため使わない。
      zIndex: 'var(--tm-z-popover)',
      ...popoverPositionVisibilityStyle(layoutSettled.value),
      ...popoverMaxHeightStyle(maxHeight, scrollbarGutter),
      ...popoverScrollbarGutterStyle(scrollbarGutter),
    }
  })

  function readOpen (source: WatchSource<boolean>): boolean {
    return typeof source === 'function' ? source() : source.value
  }

  function resolveRootEl (): HTMLElement | null {
    const root = options.rootRef.value
    if (!root) {
      return null
    }
    if (root instanceof HTMLElement) {
      return root
    }
    return root.rootRef ?? null
  }

  function resolvePreferredTop (): number {
    const pad = POPOVER_VIEWPORT_INSET
    const gap = 6
    if (!import.meta.client) {
      return pad
    }
    const subheader = document.querySelector('.page-header .subheader')
    if (subheader instanceof HTMLElement) {
      return Math.max(pad, subheader.getBoundingClientRect().bottom + gap)
    }
    return pad
  }

  function readBaseWidth (): number {
    const source = options.baseWidth
    if (typeof source === 'number') {
      return source
    }
    return typeof source === 'function' ? source() : source.value
  }

  function positionPopover () {
    if (!import.meta.client) {
      position.value = null
      return
    }
    const pad = POPOVER_VIEWPORT_INSET
    const preferredTop = resolvePreferredTop()
    const el = resolveRootEl()
    const baseWidth = readBaseWidth()
    const measuredHeight = el ? measurePopoverNaturalHeight(el) : 0
    const vertical = resolveFlippedPopoverVerticalLayout(preferredTop, {
      pad,
      contentHeight: measuredHeight,
    })
    const maxHeight = vertical.maxHeight
    const scrollbarGutter = el
      ? resolvePopoverScrollbarGutter(el, maxHeight, baseWidth)
      : 0
    const measuredWidth = el ? Math.ceil(el.getBoundingClientRect().width) : 0
    const width = measuredWidth > 0
      ? measuredWidth
      : baseWidth + popoverWidthExtraForGutter(scrollbarGutter)
    const left = Math.max(pad, window.innerWidth - width - pad)
    position.value = {
      top: vertical.top,
      left,
      maxHeight,
      scrollbarGutter,
    }
  }

  function close () {
    if (!options.canClose()) {
      return
    }
    options.onClose()
  }

  function onAfterLeave () {
    layoutSettled.value = false
    position.value = null
  }

  useExclusivePopover(options.isExclusiveOpen ?? options.isOpen, close)
  useDropdownEscapeClose(options.isExclusiveOpen ?? options.isOpen, close)

  watch(options.isOpen, (open) => {
    if (!open) {
      return
    }
    if (layoutSettled.value && position.value) {
      nextTick(() => positionPopover())
      return
    }
    layoutSettled.value = false
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionPopover(),
        () => {
          layoutSettled.value = true
        },
      )
    })
  })

  if (import.meta.client) {
    useEventListener(window, 'resize', () => {
      if (!readOpen(options.isOpen)) {
        return
      }
      positionPopover()
    })
  }

  return {
    style,
    panelWidth,
    close,
    onAfterLeave,
    positionPopover,
  }
}
