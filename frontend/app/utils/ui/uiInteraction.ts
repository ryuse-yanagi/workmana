import { closeExclusivePopoverIfOpen } from '../../composables/ui/useExclusivePopover'

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
  '.workspace-wbs__drag-handle',
  // 列幅リサイズのみ常時対象外（ガント上側ヘッダーはドラッグ可）
  '.workspace-wbs__resize-handle',
  '.popover-layer',
  '.popover',
  '.popover-shell',
  '.board-filter-dropdown',
  '.workspace-member-picker-popover',
  '.workspace-status-select__dropdown',
  '.document-category-select__dropdown',
  '.settings-sidebar',
  '[data-no-drag-scroll]',
].join(', ')
const MODAL_OVERLAY_SELECTOR = '.modal-overlay, .base-modal-overlay'
/** メニュー／プルダウンの開閉トリガー — 外側クリック閉じの対象外（各トリガーがトグルで閉じる） */
export const POPOVER_TRIGGER_SELECTOR = [
  '[data-popover-trigger]',
  '.action-buttons .action-btn',
  '.detail-value-btn',
  '.member-avatar-btn',
  '.task-detail-list-badge',
  '.task-detail-list-btn',
  '.workspace-form-status-btn',
  '.label-chip',
  '.label-chip-add',
  '.workspace-wbs__cell-btn',
  '.workspace-wbs__avatar-btn',
  '.workspace-wbs__members-cell',
  '.workspace-sidebar__assignee-avatar',
  /** ガントバー色ピッカーは pointerup で開くため、続く click で即閉じない */
  '.workspace-wbs__day-cell',
  '.workspace-wbs__gantt-edge',
].join(', ')
/** body Teleport 先のポップオーバー／ドロップダウン内クリック */
const FLOATING_POPOVER_ROOT_SELECTOR = [
  '.popover-layer',
  '.popover-shell',
  '.workspace-status-select__dropdown',
  '.document-category-select__dropdown',
  '.workspace-member-picker-popover',
  '.floating-menu',
  '.board-filter-dropdown',
  '.gantt-color-popover-layer',
  '.popover',
  '[data-popover-panel]',
].join(',')
/** 作成・編集・削除モーダル等の決定ショートカット（Ctrl+Enter / Mac は Cmd+Enter） */
export function isCtrlEnterKeydown (event: KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey)
}
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/** 文字入力できる欄か。ポップオーバー内の検索・説明も対象 */
function isTextEntryTarget (target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  const field = target.closest(FORM_OR_EDITOR_SELECTOR)
  if (!field) {
    return false
  }
  if (field instanceof HTMLInputElement) {
    if (NON_TEXT_INPUT_TYPES.has(field.type) || field.disabled || field.readOnly) {
      return false
    }
  }
  if (field instanceof HTMLTextAreaElement && (field.disabled || field.readOnly)) {
    return false
  }
  return true
}

/** 入力中・編集 UI 上ではキーボードショートカットを無効にする。
 * ポップオーバー内でも文字入力欄はショートカットより入力を優先する。
 * 入力欄以外のポップオーバー上では、従来どおりショートカットを優先する。
 */
export function isKeyboardShortcutBlockedTarget (target: EventTarget | null): boolean {
  if (isTextEntryTarget(target)) {
    return true
  }
  if (target instanceof Node && isInsideFloatingPopover(target)) {
    return false
  }
  return isInsideSelectableText(target)
}
/** 最前面のモーダルオーバーレイ（ネスト時は z-index が最大のもの） */
export function getTopmostModalOverlay (): HTMLElement | null {
  if (!import.meta.client) {
    return null
  }
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>(MODAL_OVERLAY_SELECTOR),
  ).filter((el) => {
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  if (!overlays.length) {
    return null
  }
  return overlays.reduce((top, el) => {
    const zEl = Number.parseInt(getComputedStyle(el).zIndex, 10) || 0
    const zTop = Number.parseInt(getComputedStyle(top).zIndex, 10) || 0
    return zEl >= zTop ? el : top
  })
}
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
/**
 * WBS ドラッグスクロール対象外:
 * - 編集モードのガント本体（日セル・バー端）※上側ヘッダーは可
 * - 列幅リサイズハンドル
 * - 編集時の並び替えハンドル・タイトル入力中・明示除外
 * （タイトルセル自体はクリックで編集・ドラッグでスクロール）
 */
function isExcludedWorkspaceWbsDragScrollTarget (target: Element): boolean {
  const inEdit = Boolean(target.closest('.workspace-wbs--edit'))

  // 編集モードのガント本体のみ対象外（月ナビ／日付ヘッダーはドラッグ移動可）
  if (inEdit && target.closest('.workspace-wbs__day-cell, .workspace-wbs__gantt-edge')) {
    return true
  }
  if (target.closest('.workspace-wbs__resize-handle')) {
    return true
  }
  if (
    inEdit
    && target.closest('.workspace-wbs__drag-handle, .workspace-wbs__title-input, [data-no-drag-scroll]')
  ) {
    return true
  }
  return false
}
/**
 * WBSの項目名ヘッダー・ガント上側ヘッダー・本文を
 * 縦横ドラッグスクロール対象にする。
 * 編集モードのガント本体（日セル）のみ対象外。
 */
function resolveWorkspaceWbsDragScrollContainer (target: Element): {
  container: Element
  axes: ScrollAxes
} | null {
  if (isExcludedWorkspaceWbsDragScrollTarget(target)) {
    return null
  }
  const table = target.closest('.workspace-wbs')
  const viewport = target.closest('.workspace-wbs-board__viewport')
  if (!(table instanceof Element) || !(viewport instanceof Element)) {
    return null
  }
  const axes = getScrollAxes(viewport)
  return axes.x || axes.y ? { container: viewport, axes } : null
}
/** ボード背景ドラッグは横スクロールのみ。それ以外は最寄りのスクロール容器を使う。 */
export function resolveDragScrollContainer (target: Element): {
  container: Element
  axes: ScrollAxes
} | null {
  if (isExcludedWorkspaceWbsDragScrollTarget(target)) {
    return null
  }
  const wbsContainer = resolveWorkspaceWbsDragScrollContainer(target)
  if (wbsContainer) {
    return wbsContainer
  }
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
  if (isExcludedWorkspaceWbsDragScrollTarget(target)) {
    return false
  }
  if (resolveWorkspaceWbsDragScrollContainer(target)) {
    return true
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
let suppressNextOverlayBackdropClose = false
/** モーダル背面（カード外の暗い領域）を直接クリックしたか */
export function isModalOverlayBackdropTarget (target: Node): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  const overlay = target.closest(MODAL_OVERLAY_SELECTOR)
  return overlay instanceof Element && target === overlay
}
/** 浮動ポップオーバー／ドロップダウン内のクリックか */
export function isInsideFloatingPopover (target: Node): boolean {
  const el = target instanceof Element ? target : target.parentElement
  if (!el) {
    return false
  }
  return el.closest(FLOATING_POPOVER_ROOT_SELECTOR) != null
}

/** ポップオーバー内で pointerdown したジェスチャか（外で pointerup しても閉じない） */
let pointerDownInsideFloatingPopover = false
let popoverPointerGestureTrackingInstalled = false

function onDocumentPointerDownForPopoverGesture (event: PointerEvent) {
  if (event.button !== 0) {
    return
  }
  const target = event.target
  pointerDownInsideFloatingPopover = target instanceof Node && isInsideFloatingPopover(target)
}

export function ensurePopoverPointerGestureTracking () {
  if (popoverPointerGestureTrackingInstalled || !import.meta.client) {
    return
  }
  popoverPointerGestureTrackingInstalled = true
  document.addEventListener('pointerdown', onDocumentPointerDownForPopoverGesture, true)
}

/** 現在のポインタ操作がポップオーバー内の pointerdown から始まっているか */
export function didPointerGestureStartInsideFloatingPopover (): boolean {
  return pointerDownInsideFloatingPopover
}
/** ポップオーバー開閉トリガー上のクリックか */
export function isPopoverTriggerTarget (target: Node): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  return target.closest(POPOVER_TRIGGER_SELECTOR) != null
}
const POPOVER_SHELL_SELECTOR = '.popover-layer, .popover-shell, .popover'
/** 外側クリックで閉じるべきポップオーバーが開いているとき、対象クリックか */
export function shouldDismissPopoverForPointerTarget (target: Node): boolean {
  if (didPointerGestureStartInsideFloatingPopover()) {
    return false
  }
  if (isInsideFloatingPopover(target)) {
    return false
  }
  if (isPopoverTriggerTarget(target)) {
    return false
  }
  if (target instanceof Element && target.closest(POPOVER_SHELL_SELECTOR)) {
    return false
  }
  if (target instanceof Element && target.closest('[data-popover-panel], .notifications-drawer-overlay')) {
    return false
  }
  return true
}
/**
 * プルダウン外クリックでモーダル背面を押したとき、続く mouseup によるモーダル閉じを抑止する。
 * （プルダウンが mouseup で閉じるとき、同じ mouseup でモーダルまで閉じないようにする）
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
  if (didPointerGestureStartInsideFloatingPopover()) {
    return
  }
  if (isModalOverlayBackdropTarget(target)) {
    suppressOverlayBackdropCloseOnce()
  }
  void dismiss()
}
/** モーダルを閉じる前に、開いている排他ポップオーバーを閉じる（閉じた場合は true） */
export function dismissExclusivePopoverBeforeModalClose (): boolean {
  return closeExclusivePopoverIfOpen()
}
/**
 * capture の scroll 監視で、ポップオーバー内部スクロールを除外する。
 * （内部スクロールのたびに再配置すると高さ計測でスクロールが潰れる）
 */
export function isScrollInsideRoot (
  event: Event,
  root: Element | null | undefined,
): boolean {
  if (!root) {
    return false
  }
  const target = event.target
  if (!(target instanceof Node)) {
    return false
  }
  return target === root || root.contains(target)
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
      if (closeExclusivePopoverIfOpen()) {
        suppressOverlayBackdropCloseOnce()
        return
      }
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

ensurePopoverPointerGestureTracking()
