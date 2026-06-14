import {
  findScrollableAncestor,
  isInsideSelectableText,
  shouldEnableDragScroll,
} from '../utils/uiInteraction'

const DRAG_SCROLL_THRESHOLD_PX = 4

interface DragScrollSession {
  container: Element
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

    const container = findScrollableAncestor(event.target as Element)
    if (!container) {
      return
    }

    dragScroll = {
      container,
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
      if (
        Math.abs(deltaX) < DRAG_SCROLL_THRESHOLD_PX
        && Math.abs(deltaY) < DRAG_SCROLL_THRESHOLD_PX
      ) {
        return
      }
      dragScroll.active = true
    }

    dragScroll.container.scrollLeft = dragScroll.scrollLeft - deltaX
    dragScroll.container.scrollTop = dragScroll.scrollTop - deltaY
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
