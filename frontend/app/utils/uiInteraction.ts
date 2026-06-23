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
  '.settings-sidebar',
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

/** ボード背景ドラッグは横スクロールのみ。それ以外は最寄りのスクロール容器を使う。 */
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

/** オーバーレイ上で pointerdown/pointerup したときだけ閉じる（モーダル内開始→外終了は閉じない） */
const MODAL_OVERLAY_SELECTOR = '.modal-overlay, .base-modal-overlay'

let suppressNextOverlayBackdropClose = false

/** モーダル背面（カード外の暗い領域）を直接クリックしたか */
export function isModalOverlayBackdropTarget (target: Node): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  const overlay = target.closest(MODAL_OVERLAY_SELECTOR)
  return overlay instanceof Element && target === overlay
}

/**
 * プルダウン外クリックでモーダル背面を押したとき、続く mouseup によるモーダル閉じを抑止する。
 * （capture 段階でプルダウンが先に閉じると、mouseup 時には開いていないためモーダルまで閉じてしまうのを防ぐ）
 */
export function suppressOverlayBackdropCloseOnce () {
  suppressNextOverlayBackdropClose = true
}

function consumeOverlayBackdropCloseSuppression (): boolean {
  if (!suppressNextOverlayBackdropClose) {
    return false
  }
  suppressNextOverlayBackdropClose = false
  return true
}

/** ポップオーバーの外側クリックで閉じる。モーダル背面ならモーダルは閉じない */
export function dismissPopoverFromOutsidePointer (
  target: Node,
  dismiss: () => void | Promise<void>,
) {
  if (isModalOverlayBackdropTarget(target)) {
    suppressOverlayBackdropCloseOnce()
  }
  void dismiss()
}

export function createOverlayBackdropClose (options: {
  onClose: () => void
  canClose?: () => boolean
}) {
  let pendingOverlay: HTMLElement | null = null

  function detachDocumentMouseUp () {
    document.removeEventListener('mouseup', onDocumentMouseUp, true)
  }

  function onDocumentMouseUp (event: MouseEvent) {
    detachDocumentMouseUp()
    const overlay = pendingOverlay
    pendingOverlay = null
    if (!overlay || event.button !== 0) {
      return
    }
    if (!(options.canClose?.() ?? true)) {
      return
    }
    if (consumeOverlayBackdropCloseSuppression()) {
      return
    }
    if (event.target === overlay) {
      options.onClose()
    }
  }

  function onOverlayMouseDown (event: MouseEvent) {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return
    }
    pendingOverlay = event.currentTarget as HTMLElement
    detachDocumentMouseUp()
    document.addEventListener('mouseup', onDocumentMouseUp, true)
  }

  function resetOverlayBackdropClose () {
    pendingOverlay = null
    suppressNextOverlayBackdropClose = false
    detachDocumentMouseUp()
  }

  return {
    onOverlayMouseDown,
    resetOverlayBackdropClose,
  }
}
