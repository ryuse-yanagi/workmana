type PopoverTextField = HTMLInputElement | HTMLTextAreaElement

const FOCUS_RETRY_FRAMES = 24

function isShownForFocus (el: Element): boolean {
  if (!el.isConnected) {
    return false
  }
  let node: Element | null = el
  while (node instanceof HTMLElement) {
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
    node = node.parentElement
  }
  return true
}

/**
 * ポップオーバー表示直後に入力欄へフォーカスする。
 * Transition / Teleport / 位置決め中の visibility:hidden / クリック由来の
 * フォーカス奪取を避けるため、表示されてから nextTick と複数フレームで再試行する。
 */
export function schedulePopoverInputFocus (
  getEl: () => PopoverTextField | null | undefined,
  options?: {
    select?: 'all' | 'end' | 'none'
    preventScroll?: boolean
  },
) {
  if (!import.meta.client) {
    return
  }
  const select = options?.select ?? 'none'
  const preventScroll = options?.preventScroll ?? true

  const apply = () => {
    const el = getEl()
    if (!el || el.disabled || !isShownForFocus(el)) {
      return false
    }
    el.focus({ preventScroll })
    if (select === 'all' && typeof el.select === 'function') {
      el.select()
    } else if (select === 'end') {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
    return document.activeElement === el
  }

  void nextTick(() => {
    let frames = 0
    const tick = () => {
      if (apply()) {
        return
      }
      frames += 1
      if (frames < FOCUS_RETRY_FRAMES) {
        requestAnimationFrame(tick)
      }
    }
    tick()
  })
}
