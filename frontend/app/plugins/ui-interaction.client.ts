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
    if (event.button !== 0 || isInsideSelectableText(event.target)) {
      return
    }
    if (!shouldEnableDragScroll(event.target)) {
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
    clearDragScroll(event.pointerId)
  }
  document.addEventListener('pointerdown', onPointerDown, { capture: true })
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
  document.addEventListener('pointerup', onPointerEnd, { capture: true })
  document.addEventListener('pointercancel', onPointerEnd, { capture: true })
  window.addEventListener('blur', () => clearDragScroll())
})
