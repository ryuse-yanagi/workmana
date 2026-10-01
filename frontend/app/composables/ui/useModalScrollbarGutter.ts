import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import {
  classicScrollbarWidth,
  popoverScrollbarLayoutStyle,
} from '../../utils/ui/popoverScrollbar'

const OVERLAY_SCROLLBAR_RESERVE_PX = 12

function scrollbarGutterForOverflow (): number {
  const classic = classicScrollbarWidth()
  return classic > 0 ? classic : OVERLAY_SCROLLBAR_RESERVE_PX
}

function widthWithOptionalGutter (width: string, gutterPx: number): string {
  const trimmed = width.trim()
  if (gutterPx <= 0) {
    return trimmed
  }
  const minMatch = trimmed.match(/^min\(\s*(.+?)\s*,\s*100%\s*\)$/i)
  if (!minMatch) {
    return trimmed
  }
  const inner = minMatch[1].trim()
  if (inner.includes(`${gutterPx}px`)) {
    return trimmed
  }
  if (inner.startsWith('calc(') && inner.endsWith(')')) {
    const calcBody = inner.slice(5, -1).trim()
    return `min(calc(${calcBody} + ${gutterPx}px), 100%)`
  }
  return `min(calc(${inner} + ${gutterPx}px), 100%)`
}

function resolveModalBodyScroller (
  card: HTMLElement,
  scrollerSelector?: string,
): HTMLElement | null {
  if (scrollerSelector) {
    const found = card.querySelector(scrollerSelector)
    if (found instanceof HTMLElement) {
      return found
    }
  }
  for (const child of Array.from(card.children)) {
    if (!(child instanceof HTMLElement)) {
      continue
    }
    if (
      child.classList.contains('base-modal-header')
      || child.classList.contains('modal-header')
    ) {
      continue
    }
    const nested = child.querySelector<HTMLElement>(
      '.modal-body, .modal-pane--detail__scroller, [data-modal-scroller]',
    )
    if (nested) {
      return nested
    }
    return child
  }
  return null
}

/**
 * モーダルカードで縦スクロールが必要なときだけ gutter CSS 変数と幅加算を行う。
 */
export function useModalScrollbarGutter (options: {
  cardRef: Ref<HTMLElement | null>
  open: Ref<boolean> | (() => boolean)
  /** CSS width 文字列（例: min(560px, 100%)）。省略時は幅をいじらない */
  width?: Ref<string> | (() => string | undefined)
  scrollerSelector?: string
}) {
  const scrollbarGutter = ref(0)
  let observer: ResizeObserver | null = null

  const isOpen = () => (
    typeof options.open === 'function' ? options.open() : options.open.value
  )

  const resolveWidth = () => {
    if (!options.width) {
      return undefined
    }
    return typeof options.width === 'function' ? options.width() : options.width.value
  }

  function sync () {
    const card = options.cardRef.value
    if (!card || !isOpen()) {
      scrollbarGutter.value = 0
      return
    }
    const scroller = resolveModalBodyScroller(card, options.scrollerSelector)
    if (!scroller) {
      scrollbarGutter.value = 0
      return
    }
    const needsScroll = scroller.scrollHeight > scroller.clientHeight + 1
    const next = needsScroll ? scrollbarGutterForOverflow() : 0
    if (scrollbarGutter.value !== next) {
      scrollbarGutter.value = next
    }
  }

  function bind () {
    unbind()
    const card = options.cardRef.value
    if (!card || typeof ResizeObserver === 'undefined') {
      return
    }
    const scroller = resolveModalBodyScroller(card, options.scrollerSelector)
    observer = new ResizeObserver(() => {
      sync()
    })
    observer.observe(card)
    if (scroller) {
      observer.observe(scroller)
    }
    sync()
  }

  function unbind () {
    observer?.disconnect()
    observer = null
  }

  const scrollbarStyle = computed(() => {
    const gutter = scrollbarGutter.value
    const width = resolveWidth()
    return {
      ...(width != null ? { width: widthWithOptionalGutter(width, gutter) } : {}),
      ...popoverScrollbarLayoutStyle(gutter, true),
    }
  })

  watch(isOpen, (open) => {
    if (!import.meta.client) {
      return
    }
    if (open) {
      nextTick(() => {
        bind()
      })
    } else {
      unbind()
      scrollbarGutter.value = 0
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    unbind()
  })

  return {
    scrollbarGutter,
    scrollbarStyle,
    syncModalScrollbarGutter: sync,
  }
}
