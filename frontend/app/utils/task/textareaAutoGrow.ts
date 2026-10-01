const MODAL_SCROLLER_SELECTOR = '.modal-body, .modal-pane--detail__scroller, [data-modal-scroller]'

/** 入力行がスクロール端に張り付かないように空ける余白 */
const CARET_VIEW_MARGIN_PX = 12

const MIRROR_STYLE_PROPS = [
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'line-height',
  'font-family',
  'text-align',
  'text-transform',
  'text-indent',
  'letter-spacing',
  'word-spacing',
  'tab-size',
  'overflow-wrap',
  'word-break',
] as const

/**
 * 説明 textarea など — 入力に応じて縦方向へ伸長させる。
 * 計測中に本文を縮めると、モーダルのスクロールバーが点滅し、表示位置が先頭へ戻る。
 * フォーカス中は、伸長後に入力行がモーダル内へ収まるようスクロールする。
 */
export function adjustTextareaHeight (textarea: HTMLTextAreaElement | null | undefined): void {
  if (!textarea) {
    return
  }
  const scroller = textarea.closest(MODAL_SCROLLER_SELECTOR)
  const scrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : null
  const parent = textarea.parentElement
  const width = textarea.getBoundingClientRect().width
  const holder = document.createElement('div')
  holder.setAttribute('aria-hidden', 'true')
  holder.style.height = `${textarea.offsetHeight}px`
  holder.style.width = `${width}px`
  parent?.insertBefore(holder, textarea)

  const previousPosition = textarea.style.position
  const previousWidth = textarea.style.width
  textarea.style.position = 'absolute'
  textarea.style.width = `${width}px`
  textarea.style.height = 'auto'
  const nextHeight = textarea.scrollHeight
  textarea.style.position = previousPosition
  textarea.style.width = previousWidth
  textarea.style.height = `${nextHeight}px`
  holder.remove()

  if (!(scroller instanceof HTMLElement) || scrollTop === null) {
    return
  }
  const applyScroll = () => {
    if (scroller.scrollTop !== scrollTop) {
      scroller.scrollTop = scrollTop
    }
    if (document.activeElement === textarea) {
      revealCaretInScroller(textarea, scroller)
    }
  }
  applyScroll()
  const desiredScrollTop = scroller.scrollTop
  requestAnimationFrame(() => {
    if (scroller.scrollTop !== desiredScrollTop) {
      scroller.scrollTop = desiredScrollTop
    }
  })
}

const CARET_MOVE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

export function isCaretMoveKey (key: string): boolean {
  return CARET_MOVE_KEYS.has(key)
}

/** 矢印キーなどでキャレットだけ動いたとき、入力行を表示範囲へ戻す */
export function ensureTextareaCaretVisible (textarea: HTMLTextAreaElement | null | undefined): void {
  if (!textarea || document.activeElement !== textarea) {
    return
  }
  const scroller = textarea.closest(MODAL_SCROLLER_SELECTOR)
  if (!(scroller instanceof HTMLElement)) {
    return
  }
  revealCaretInScroller(textarea, scroller)
}

function revealCaretInScroller (textarea: HTMLTextAreaElement, scroller: HTMLElement): void {
  const caret = measureTextareaCaret(textarea)
  const scrollerRect = scroller.getBoundingClientRect()
  const textareaRect = textarea.getBoundingClientRect()
  const caretTop = scroller.scrollTop + (textareaRect.top - scrollerRect.top) + caret.top
  const caretBottom = caretTop + caret.height
  const viewTop = scroller.scrollTop + CARET_VIEW_MARGIN_PX
  const viewBottom = scroller.scrollTop + scroller.clientHeight - CARET_VIEW_MARGIN_PX
  if (caretBottom > viewBottom) {
    scroller.scrollTop += caretBottom - viewBottom
  } else if (caretTop < viewTop) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - (viewTop - caretTop))
  }
}

/** textarea 内キャレットの top / height（ボーダー上端基準） */
function measureTextareaCaret (textarea: HTMLTextAreaElement): { top: number, height: number } {
  const computed = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  const style = mirror.style
  style.position = 'absolute'
  style.left = '0'
  style.top = '0'
  style.visibility = 'hidden'
  style.pointerEvents = 'none'
  style.whiteSpace = 'pre-wrap'
  style.wordWrap = 'break-word'
  style.overflow = 'hidden'
  style.boxSizing = 'border-box'
  style.width = `${textarea.getBoundingClientRect().width}px`
  for (const prop of MIRROR_STYLE_PROPS) {
    style.setProperty(prop, computed.getPropertyValue(prop))
  }
  const value = textarea.value
  const position = textarea.selectionDirection === 'backward'
    ? textarea.selectionStart
    : textarea.selectionEnd
  mirror.textContent = value.slice(0, position)
  const marker = document.createElement('span')
  const nextChar = value.slice(position, position + 1)
  marker.textContent = nextChar && nextChar !== '\n' && nextChar !== '\r' ? nextChar : '.'
  mirror.appendChild(marker)
  const windowX = window.scrollX
  const windowY = window.scrollY
  document.body.appendChild(mirror)
  const borderTop = Number.parseFloat(computed.borderTopWidth) || 0
  const lineHeight = Number.parseFloat(computed.lineHeight)
  const top = marker.offsetTop + borderTop
  const height = Number.isFinite(lineHeight) && lineHeight > 0
    ? lineHeight
    : (marker.offsetHeight || 20)
  mirror.remove()
  if (window.scrollX !== windowX || window.scrollY !== windowY) {
    window.scrollTo(windowX, windowY)
  }
  return { top, height }
}
