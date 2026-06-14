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

export function isScrollableElement (el: Element): boolean {
  const style = getComputedStyle(el)
  const canScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll')
    && el.scrollHeight > el.clientHeight + 1
  const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll')
    && el.scrollWidth > el.clientWidth + 1
  return canScrollY || canScrollX
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
  return findScrollableAncestor(target) !== null
}
