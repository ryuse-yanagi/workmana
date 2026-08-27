/** CSS 変数。幅 mixin `popover-panel-width` が参照する */
export const POPOVER_SCROLLBAR_GUTTER_VAR = '--tm-popover-scrollbar-gutter'
/** オーバーレイ型スクロールバー用の右パディング（クラシック型では 0） */
export const POPOVER_SCROLLBAR_OVERLAY_PAD_VAR = '--tm-popover-scrollbar-overlay-pad'

/** 実際に overflow-y: auto でスクロールする要素（外側の overflow:hidden シェルは含めない） */
const POPOVER_SCROLLER_SELECTOR = [
  '.popover-scroll',
  '.document-label-select__list',
  '.workspace-status-select__list',
  '.document-category-select__list',
  '.board-filter-dropdown',
].join(',')

/** classicScrollbarWidth が 0（オーバーレイ型）でも右端が隠れないよう確保する幅 */
const OVERLAY_SCROLLBAR_RESERVE_PX = 12

let cachedClassicScrollbarWidth: number | null = null

/** オーバレイ型スクロールバーでは 0。クラシック型では予約幅（例: 12〜17px） */
export function classicScrollbarWidth (): number {
  if (typeof document === 'undefined') return 0
  if (cachedClassicScrollbarWidth != null) return cachedClassicScrollbarWidth
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden'
  document.body.appendChild(probe)
  cachedClassicScrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth)
  probe.remove()
  return cachedClassicScrollbarWidth
}

export function popoverScrollbarGutterStyle (gutterPx: number): Record<string, string> {
  const amount = Math.max(0, gutterPx)
  if (amount <= 0) {
    return {
      [POPOVER_SCROLLBAR_GUTTER_VAR]: '0px',
      [POPOVER_SCROLLBAR_OVERLAY_PAD_VAR]: '0px',
    }
  }
  const classic = classicScrollbarWidth()
  if (classic > 0) {
    return {
      [POPOVER_SCROLLBAR_GUTTER_VAR]: `${amount}px`,
      [POPOVER_SCROLLBAR_OVERLAY_PAD_VAR]: '0px',
    }
  }
  return {
    [POPOVER_SCROLLBAR_GUTTER_VAR]: '0px',
    [POPOVER_SCROLLBAR_OVERLAY_PAD_VAR]: `${amount}px`,
  }
}

/**
 * flex 列 + 内側スクロールのポップオーバー用。
 * スクロールが必要なときは max-height だけでなく height も固定する
 * （max-height だけだと内側が縮まずスクロール不能になることがある）。
 */
export function popoverMaxHeightStyle (
  maxHeightPx: number,
  scrollbarGutterPx: number,
): Record<string, string> {
  const maxHeight = `${Math.max(0, maxHeightPx)}px`
  if (scrollbarGutterPx > 0) {
    return { maxHeight, height: maxHeight }
  }
  return { maxHeight }
}

export function resolvePopoverScroller (root: HTMLElement): HTMLElement {
  if (root.matches(POPOVER_SCROLLER_SELECTOR)) {
    const nested = root.querySelector(POPOVER_SCROLLER_SELECTOR)
    if (nested instanceof HTMLElement) {
      return nested
    }
    return root
  }
  const inner = root.querySelector(POPOVER_SCROLLER_SELECTOR)
  return inner instanceof HTMLElement ? inner : root
}

function unconstrainedScrollHeight (el: HTMLElement): number {
  const prev = el.style.maxHeight
  el.style.maxHeight = 'none'
  const height = el.scrollHeight
  el.style.maxHeight = prev
  return height
}

function scrollbarGutterForOverflow (): number {
  const classic = classicScrollbarWidth()
  return classic > 0 ? classic : OVERLAY_SCROLLBAR_RESERVE_PX
}

/** パネル幅に足す量。オーバーレイ型はパディングで退避するため 0 */
export function popoverWidthExtraForGutter (gutterPx: number): number {
  if (gutterPx <= 0) return 0
  return classicScrollbarWidth() > 0 ? gutterPx : 0
}

/**
 * ポップオーバーに max-height を付けたとき縦スクロールが必要なら、
 * 一覧幅を削らず外側を広げる／オーバーレイ時は右パッドするための量を返す。
 */
export function resolvePopoverScrollbarGutter (
  popover: HTMLElement,
  popoverMaxHeightPx: number,
): number {
  if (popoverMaxHeightPx <= 0) return 0

  popover.style.setProperty(POPOVER_SCROLLBAR_GUTTER_VAR, '0px')
  popover.style.setProperty(POPOVER_SCROLLBAR_OVERLAY_PAD_VAR, '0px')

  const scroller = resolvePopoverScroller(popover)
  if (scroller === popover) {
    const needsScroll = unconstrainedScrollHeight(popover) > popoverMaxHeightPx + 1
      || popover.scrollHeight > popover.clientHeight + 1
    return needsScroll ? scrollbarGutterForOverflow() : 0
  }

  const prevMaxHeight = popover.style.maxHeight
  const prevHeight = popover.style.height
  popover.style.maxHeight = 'none'
  popover.style.height = 'auto'
  const chrome = Math.max(0, popover.offsetHeight - scroller.offsetHeight)
  popover.style.maxHeight = prevMaxHeight
  popover.style.height = prevHeight

  const scrollerMax = Math.max(0, popoverMaxHeightPx - chrome)
  const needsScroll = unconstrainedScrollHeight(scroller) > scrollerMax + 1
    || scroller.scrollHeight > scroller.clientHeight + 1
  return needsScroll ? scrollbarGutterForOverflow() : 0
}
