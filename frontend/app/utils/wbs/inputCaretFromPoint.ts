/**
 * `<input type="text">` 上の clientX からキャレット位置（文字インデックス）を求める。
 * 表示用テキストと同一フォント前提で幅を二分探索する。
 */
export function caretIndexAtClientX (input: HTMLInputElement, clientX: number): number {
  const value = input.value
  if (!value) {
    return 0
  }

  const style = window.getComputedStyle(input)
  const rect = input.getBoundingClientRect()
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0
  const targetX = clientX - rect.left - paddingLeft - borderLeft + input.scrollLeft

  if (targetX <= 0) {
    return 0
  }

  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    font: style.font,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
  })
  document.body.appendChild(mirror)

  const widthAt = (index: number): number => {
    mirror.textContent = value.slice(0, index)
    return mirror.offsetWidth
  }

  try {
    if (targetX >= widthAt(value.length)) {
      return value.length
    }

    let low = 0
    let high = value.length
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (widthAt(mid) <= targetX) {
        low = mid
      } else {
        high = mid - 1
      }
    }

    if (low >= value.length) {
      return value.length
    }

    const left = widthAt(low)
    const right = widthAt(low + 1)
    return targetX - left > right - targetX ? low + 1 : low
  } finally {
    mirror.remove()
  }
}
