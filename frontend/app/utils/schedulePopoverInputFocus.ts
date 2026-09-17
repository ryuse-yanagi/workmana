type PopoverTextField = HTMLInputElement | HTMLTextAreaElement

/**
 * ポップオーバー表示直後に入力欄へフォーカスする。
 * Transition / Teleport / クリック由来のフォーカス奪取を避けるため、
 * nextTick と 2 フレーム後にも再試行する。
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
    if (!el || el.disabled) {
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
    if (apply()) {
      return
    }
    requestAnimationFrame(() => {
      if (apply()) {
        return
      }
      requestAnimationFrame(() => {
        apply()
      })
    })
  })
}
