import {
  isInsideSelectableText,
  resolveDragScrollContainer,
  shouldEnableDragScroll,
  type ScrollAxes,
} from '../utils/uiInteraction'
const DRAG_SCROLL_THRESHOLD_PX = 4
interface DragScrollSession {
  container: Element
  axes: ScrollAxes
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
  active: boolean
}
export default defineNuxtPlugin(() => {
  if (!import.meta.client) {
    return
  }
  let dragScroll: DragScrollSession | null = null
  let suppressNextClick = false
  let suppressClickTimer: ReturnType<typeof setTimeout> | null = null
  const clearDragScroll = (pointerId?: number) => {
    if (!dragScroll) {
      return
    }
    if (pointerId !== undefined && dragScroll.pointerId !== pointerId) {
      return
    }
    dragScroll = null
  }
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return
    }
    if (!shouldEnableDragScroll(event.target)) {
      return
    }
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const resolved = resolveDragScrollContainer(target)
    if (!resolved) {
      return
    }
    // WBS viewport（項目名ヘッダー・本文）は th/td の user-select:text でもドラッグ可
    const isWbsViewportDragScroll = resolved.container.classList.contains(
      'workspace-wbs-board__viewport',
    )
    if (!isWbsViewportDragScroll && isInsideSelectableText(target)) {
      return
    }
    const { container, axes } = resolved
    dragScroll = {
      container,
      axes,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      active: false,
    }
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!dragScroll || dragScroll.pointerId !== event.pointerId) {
      return
    }
    const deltaX = event.clientX - dragScroll.startX
    const deltaY = event.clientY - dragScroll.startY
    if (!dragScroll.active) {
      const movedX = Math.abs(deltaX) >= DRAG_SCROLL_THRESHOLD_PX
      const movedY = Math.abs(deltaY) >= DRAG_SCROLL_THRESHOLD_PX
      const { x: canX, y: canY } = dragScroll.axes
      const movedOnEnabledAxis = (canX && movedX) || (canY && movedY)
      if (!movedOnEnabledAxis) {
        return
      }
      dragScroll.active = true
    }
    if (dragScroll.axes.x) {
      dragScroll.container.scrollLeft = dragScroll.scrollLeft - deltaX
    }
    if (dragScroll.axes.y) {
      dragScroll.container.scrollTop = dragScroll.scrollTop - deltaY
    }
    event.preventDefault()
  }
  const onPointerEnd = (event: PointerEvent) => {
    if (
      dragScroll
      && dragScroll.pointerId === event.pointerId
      && dragScroll.active
    ) {
      suppressNextClick = true
      if (suppressClickTimer) {
        clearTimeout(suppressClickTimer)
      }
      suppressClickTimer = setTimeout(() => {
        suppressNextClick = false
        suppressClickTimer = null
      }, 0)
    }
    clearDragScroll(event.pointerId)
  }
  /**
   * ドラッグスクロール中に画像・選択テキストのネイティブ HTML5 DnD が始まると
   * 禁止カーソルになり pointermove が止まってスクロールできなくなる。
   */
  const onDragStart = (event: DragEvent) => {
    if (!dragScroll) {
      return
    }
    event.preventDefault()
  }
  const onClick = (event: MouseEvent) => {
    if (!suppressNextClick) {
      return
    }
    suppressNextClick = false
    if (suppressClickTimer) {
      clearTimeout(suppressClickTimer)
      suppressClickTimer = null
    }
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  document.addEventListener('pointerdown', onPointerDown, { capture: true })
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
  document.addEventListener('pointerup', onPointerEnd, { capture: true })
  document.addEventListener('pointercancel', onPointerEnd, { capture: true })
  document.addEventListener('dragstart', onDragStart, { capture: true })
  document.addEventListener('click', onClick, { capture: true })
  window.addEventListener('blur', () => clearDragScroll())
})
