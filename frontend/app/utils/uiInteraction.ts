const FORM_OR_EDITOR_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '.ProseMirror',
].join(', ')

const DRAG_SCROLL_SKIP_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[contenteditable]',
  '.ProseMirror',
  '.task-card',
  '.list-header',
  '.sortable-fallback',
  '.sortable-chosen',
  '.project-wbs-table__drag-handle',
  '[data-no-drag-scroll]',
].join(', ')

/** CSS で user-select: text が指定された表示テキスト上か */
export function isInsideSelectableText (target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (target.closest(FORM_OR_EDITOR_SELECTOR)) {
    return true
  }

  let el: Element | null = target
  while (el && el !== document.body) {
    const style = getComputedStyle(el)
    const userSelect = style.userSelect || style.webkitUserSelect
    if (userSelect === 'text' || userSelect === 'contain') {
      return true
    }
    el = el.parentElement
  }

  return false
}

export type ScrollAxes = {
  x: boolean
  y: boolean
}

export function getScrollAxes (el: Element): ScrollAxes {
  const style = getComputedStyle(el)
  return {
    x: (style.overflowX === 'auto' || style.overflowX === 'scroll')
      && el.scrollWidth > el.clientWidth + 1,
    y: (style.overflowY === 'auto' || style.overflowY === 'scroll')
      && el.scrollHeight > el.clientHeight + 1,
  }
}

export function isScrollableElement (el: Element): boolean {
  const axes = getScrollAxes(el)
  return axes.x || axes.y
}

export function findScrollableAncestor (target: Element): Element | null {
  let el: Element | null = target
  while (el && el !== document.body) {
    if (isScrollableElement(el)) {
      return el
    }
    el = el.parentElement
  }
  return null
}

function isBoardDragScrollBackground (target: Element): boolean {
  return !target.closest(DRAG_SCROLL_SKIP_SELECTOR)
}

/** カンバン背景ドラッグは横スクロールのみ。それ以外は最寄りのスクロール容器を使う。 */
export function resolveDragScrollContainer (target: Element): {
  container: Element
  axes: ScrollAxes
} | null {
  const board = target.closest('.board')
  if (board instanceof Element && isBoardDragScrollBackground(target)) {
    const boardAxes = getScrollAxes(board)
    if (boardAxes.x) {
      return { container: board, axes: { x: true, y: false } }
    }
  }

  const container = findScrollableAncestor(target)
  if (!container) {
    return null
  }

  return { container, axes: getScrollAxes(container) }
}

export function shouldEnableDragScroll (target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  if (isInsideSelectableText(target)) {
    return false
  }
  if (target.closest(DRAG_SCROLL_SKIP_SELECTOR)) {
    return false
  }
  return resolveDragScrollContainer(target) !== null
}
