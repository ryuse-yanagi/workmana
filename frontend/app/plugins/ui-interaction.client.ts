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
    const isWbsBodyDragScroll = target instanceof Element
      && Boolean(resolveDragScrollContainer(target)?.container.closest('.workspace-wbs-board__viewport'))
      && Boolean(target.closest('.workspace-wbs tbody'))
    if (!isWbsBodyDragScroll && isInsideSelectableText(target)) {
      return
    }
    const resolved = resolveDragScrollContainer(event.target as Element)
    if (!resolved) {
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
  document.addEventListener('click', onClick, { capture: true })
  window.addEventListener('blur', () => clearDragScroll())
})
