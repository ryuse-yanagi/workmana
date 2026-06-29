import {
  applyTableRowOrder,
  buildFullTableDisplayRows,
  buildTableDisplayRows,
  getTableDragBlock,
  getTableDragGhostBlock,
  isTableOrphanParentTask,
  mapCollapsedTargetToFullIndex,
  moveTableDisplayRows,
  previewTableDragInsert,
  resolveOrphanParentSortOrderFromRows,
  resolveTableDropIndexFromDom,
  type TableDisplayRow,
  type TableTask,
} from './useTableTaskGroups'
type DragSession = {
  sourceIndex: number
  pointerId: number
  blockTaskIds: Set<number>
  ghostBlock: TableDisplayRow[]
  reparentedChildIds: Set<number>
  captureEl: HTMLElement
  baseRows: TableDisplayRow[]
  collapsedParentDrag: boolean
  activated: boolean
  startX: number
  startY: number
  anchorRow: HTMLTableRowElement | null
}
const DRAG_ACTIVATION_DISTANCE_PX = 5
const GHOST_TYPOGRAPHY_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'font-synthesis',
  'font-variant',
  'text-rendering',
  '-webkit-font-smoothing',
  '-moz-osx-font-smoothing',
] as const
function applyTypographyContext (source: Element, target: HTMLElement) {
  const computed = getComputedStyle(source)
  for (const prop of GHOST_TYPOGRAPHY_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (value) {
      target.style.setProperty(prop, value)
    }
  }
}
function lockElementWidth (source: HTMLElement, target: HTMLElement) {
  const width = source.getBoundingClientRect().width
  if (!width) {
    return
  }
  const widthPx = `${width}px`
  target.style.width = widthPx
  target.style.minWidth = widthPx
  target.style.maxWidth = widthPx
  target.style.boxSizing = 'border-box'
}
export type TableDragReorderSurface = {
  tableWrapSelector: string
  frameSelector: string
  tableWidthCssVar: string
  stripCellSelector?: string
  resizeHandleSelector?: string
  pageRootSelector?: string
}
export const TABLE_LIST_DRAG_SURFACE: TableDragReorderSurface = {
  tableWrapSelector: '.workspace-table-wrap',
  frameSelector: '.workspace-table-board__frame',
  tableWidthCssVar: '--table-width',
  resizeHandleSelector: '.workspace-table__resize-handle',
  pageRootSelector: '.workspace-table-board',
}
export const GANTT_DRAG_SURFACE: TableDragReorderSurface = {
  tableWrapSelector: '.workspace-gantt-table-wrap',
  frameSelector: '.workspace-gantt-board__frame',
  tableWidthCssVar: '--gantt-table-width',
  stripCellSelector: '.workspace-gantt-table__day-cell',
  pageRootSelector: '.workspace-gantt-board',
}
function syncGhostLayoutFromSource (
  sourceWrap: Element,
  wrapClone: HTMLElement,
  host: HTMLElement,
  surface: TableDragReorderSurface,
) {
  const sourceFrame = sourceWrap.closest(surface.frameSelector) as HTMLElement | null
  const sourceTable = sourceWrap.querySelector('table') as HTMLTableElement | null
  const fontSource = sourceWrap.closest('.workspace-view-page')
    ?? (surface.pageRootSelector ? sourceWrap.closest(surface.pageRootSelector) : null)
    ?? sourceTable
  if (fontSource) {
    applyTypographyContext(fontSource, host)
  }
  const tableClone = wrapClone.querySelector('table') as HTMLTableElement | null
  if (sourceTable && tableClone) {
    lockElementWidth(sourceTable, tableClone)
    tableClone.style.setProperty(
      surface.tableWidthCssVar,
      `${sourceTable.getBoundingClientRect().width}px`,
    )
    const sourceCols = sourceTable.querySelectorAll('colgroup col')
    const cloneCols = tableClone.querySelectorAll('colgroup col')
    sourceCols.forEach((col, index) => {
      const cloneCol = cloneCols[index]
      if (cloneCol instanceof HTMLElement && col instanceof HTMLElement) {
        cloneCol.style.cssText = col.style.cssText
      }
    })
  }
  const frameClone = host.querySelector(surface.frameSelector) as HTMLElement | null
  if (sourceFrame && frameClone) {
    lockElementWidth(sourceFrame, frameClone)
  }
}
function mountDragGhostFromLiveDom (
  tbody: HTMLTableSectionElement,
  ghostBlock: TableDisplayRow[],
  anchorRow: HTMLTableRowElement | null,
  clientX: number,
  clientY: number,
  surface: TableDragReorderSurface,
): {
  host: HTMLDivElement
  offsetX: number
  offsetY: number
} | null {
  const sourceWrap = tbody.closest(surface.tableWrapSelector)
  if (!sourceWrap) {
    return null
  }
  const sourceFrame = tbody.closest(surface.frameSelector)
  const ghostTaskIds = new Set(ghostBlock.map(row => row.task.id))
  const wrapClone = sourceWrap.cloneNode(true) as HTMLElement
  wrapClone.classList.add('workspace-table-wrap--dragging')
  wrapClone.querySelector('thead')?.remove()
  wrapClone.querySelectorAll('tbody tr').forEach((rowEl) => {
    const taskId = Number((rowEl as HTMLElement).dataset.tableTaskId)
    if (!ghostTaskIds.has(taskId)) {
      rowEl.remove()
    }
  })
  if (surface.stripCellSelector) {
    wrapClone.querySelectorAll(surface.stripCellSelector).forEach((el) => {
      el.remove()
    })
  }
  if (surface.resizeHandleSelector) {
    wrapClone.querySelectorAll(surface.resizeHandleSelector).forEach((el) => {
      el.remove()
    })
  }
  const host = document.createElement('div')
  host.className = 'workspace-table-drag-ghost'
  host.setAttribute('aria-hidden', 'true')
  if (sourceFrame) {
    const frameClone = sourceFrame.cloneNode(false) as HTMLElement
    frameClone.appendChild(wrapClone)
    host.appendChild(frameClone)
  } else {
    host.appendChild(wrapClone)
  }
  syncGhostLayoutFromSource(sourceWrap, wrapClone, host, surface)
  document.body.appendChild(host)
  const anchorRect = anchorRow?.getBoundingClientRect()
  return {
    host,
    offsetX: anchorRect ? clientX - anchorRect.left : 12,
    offsetY: anchorRect ? clientY - anchorRect.top : 12,
  }
}
export function useTableTaskDragReorder (options: {
  tasks: Ref<TableTask[]>
  tableBodyEl: Ref<HTMLTableSectionElement | null>
  collapsedParentIds: Ref<ReadonlySet<number>>
  orphanParentLabel: MaybeRefOrGetter<string>
  orphanParentSortOrder: MaybeRefOrGetter<number | null>
  surface?: TableDragReorderSurface
  onCommit: (
    tasks: TableTask[],
    orphanParentSortOrder: number | null,
  ) => Promise<void>
}) {
  const surface = options.surface ?? TABLE_LIST_DRAG_SURFACE
  const dragging = ref(false)
  const dropTargetIndex = ref<number | null>(null)
  const dragRows = ref<TableDisplayRow[] | null>(null)
  const draggingTaskIds = ref<ReadonlySet<number>>(new Set())
  let dragSession: DragSession | null = null
  let suppressClick = false
  let ghostEl: HTMLDivElement | null = null
  let ghostOffsetX = 0
  let ghostOffsetY = 0
  const resolveOrphanParentLabel = () => toValue(options.orphanParentLabel)
  const resolveOrphanParentSortOrder = () => toValue(options.orphanParentSortOrder)
  const activeRows = computed(() => (
    dragRows.value ?? buildTableDisplayRows(
      options.tasks.value,
      options.collapsedParentIds.value,
      resolveOrphanParentLabel(),
      resolveOrphanParentSortOrder(),
    )
  ))
  function removeDragGhost () {
    ghostEl?.remove()
    ghostEl = null
  }
  function updateDragGhostPosition (clientX: number, clientY: number) {
    if (!ghostEl) {
      return
    }
    ghostEl.style.transform = `translate(${clientX - ghostOffsetX}px, ${clientY - ghostOffsetY}px)`
  }
  function mountDragGhost (
    tbody: HTMLTableSectionElement,
    ghostBlock: TableDisplayRow[],
    anchorRow: HTMLTableRowElement | null,
    clientX: number,
    clientY: number,
  ) {
    removeDragGhost()
    const mounted = mountDragGhostFromLiveDom(
      tbody,
      ghostBlock,
      anchorRow,
      clientX,
      clientY,
      surface,
    )
    if (!mounted) {
      return
    }
    ghostEl = mounted.host
    ghostOffsetX = mounted.offsetX
    ghostOffsetY = mounted.offsetY
    updateDragGhostPosition(clientX, clientY)
  }
  function resetDragState () {
    removeDragGhost()
    dragSession = null
    dragging.value = false
    dropTargetIndex.value = null
    dragRows.value = null
    draggingTaskIds.value = new Set()
  }
  function detachDragListeners () {
    document.removeEventListener('pointermove', onDocumentPointerMove, true)
    document.removeEventListener('pointerup', onDocumentPointerUp, true)
    document.removeEventListener('pointercancel', onDocumentPointerUp, true)
  }
  function activateDragSession (event: PointerEvent) {
    if (!dragSession || dragSession.activated) {
      return
    }
    const tbody = options.tableBodyEl.value
    if (!tbody) {
      return
    }
    dragSession.activated = true
    dragging.value = true
    draggingTaskIds.value = dragSession.blockTaskIds
    dropTargetIndex.value = dragSession.sourceIndex
    syncPreview(dragSession.sourceIndex)
    const ghostMount = {
      tbody,
      ghostBlock: dragSession.ghostBlock,
      anchorRow: dragSession.anchorRow,
      clientX: event.clientX,
      clientY: event.clientY,
    }
    void nextTick(() => {
      if (!dragSession?.activated) {
        return
      }
      mountDragGhost(
        ghostMount.tbody,
        ghostMount.ghostBlock,
        ghostMount.anchorRow,
        ghostMount.clientX,
        ghostMount.clientY,
      )
    })
    document.body.style.userSelect = 'none'
  }
  function hasExceededDragActivationThreshold (event: PointerEvent): boolean {
    if (!dragSession) {
      return false
    }
    const dx = event.clientX - dragSession.startX
    const dy = event.clientY - dragSession.startY
    return (dx * dx) + (dy * dy) >= DRAG_ACTIVATION_DISTANCE_PX * DRAG_ACTIVATION_DISTANCE_PX
  }
  function releaseCapture (event: PointerEvent) {
    const captureEl = dragSession?.captureEl
    if (captureEl?.hasPointerCapture(event.pointerId)) {
      captureEl.releasePointerCapture(event.pointerId)
    }
  }
  function finishPointerSession (event: PointerEvent) {
    detachDragListeners()
    releaseCapture(event)
    document.body.style.userSelect = ''
  }
  function syncPreview (targetIndex: number) {
    if (!dragSession) {
      return
    }
    const { baseRows } = dragSession
    dropTargetIndex.value = targetIndex
    const preview = previewTableDragInsert(
      baseRows,
      dragSession.ghostBlock,
      targetIndex,
    )
    dragRows.value = preview
  }
  function onDocumentPointerMove (event: PointerEvent) {
    if (!dragSession || event.pointerId !== dragSession.pointerId) {
      return
    }
    if (!dragSession.activated) {
      if (!hasExceededDragActivationThreshold(event)) {
        return
      }
      activateDragSession(event)
    }
    const tbody = options.tableBodyEl.value
    if (!tbody) {
      return
    }
    event.preventDefault()
    updateDragGhostPosition(event.clientX, event.clientY)
    const targetIndex = resolveTableDropIndexFromDom(
      event.clientX,
      event.clientY,
      tbody,
      dragSession.baseRows,
      dragSession.blockTaskIds,
    )
    syncPreview(targetIndex)
  }
  async function onDocumentPointerUp (event: PointerEvent) {
    if (!dragSession || event.pointerId !== dragSession.pointerId) {
      return
    }
    if (!dragSession.activated) {
      finishPointerSession(event)
      dragSession = null
      return
    }
    finishPointerSession(event)
    const { sourceIndex, baseRows, reparentedChildIds, collapsedParentDrag } = dragSession
    const targetIndex = dropTargetIndex.value ?? sourceIndex
    let nextRows = moveTableDisplayRows(
      baseRows,
      sourceIndex,
      targetIndex,
      options.tasks.value,
      options.collapsedParentIds.value,
    )
    if (nextRows && collapsedParentDrag) {
      const fullRows = buildFullTableDisplayRows(
        options.tasks.value,
        resolveOrphanParentLabel(),
        resolveOrphanParentSortOrder(),
      )
      const parentId = baseRows[sourceIndex]?.task.id
      const fullSourceIndex = parentId == null
        ? -1
        : fullRows.findIndex(row => row.task.id === parentId)
      if (fullSourceIndex >= 0) {
        const fullTargetIndex = mapCollapsedTargetToFullIndex(baseRows, fullRows, targetIndex)
        nextRows = moveTableDisplayRows(
          fullRows,
          fullSourceIndex,
          fullTargetIndex,
          options.tasks.value,
        )
      }
    }
    resetDragState()
    suppressClick = true
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
    if (!nextRows) {
      return
    }
    const updatedTasks = applyTableRowOrder(
      options.tasks.value,
      nextRows,
      reparentedChildIds,
    )
    const nextOrphanParentSortOrder = resolveOrphanParentSortOrderFromRows(
      nextRows,
      updatedTasks,
    )
    options.tasks.value = updatedTasks
    try {
      await options.onCommit(updatedTasks, nextOrphanParentSortOrder)
    } catch {
      // Caller handles rollback/reload.
    }
  }
  function onDragHandlePointerDown (taskId: number, event: PointerEvent) {
    if (event.button !== 0 || dragSession) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget as HTMLElement | null
    if (!handle) {
      return
    }
    const tbody = options.tableBodyEl.value
    if (!tbody) {
      return
    }
    const baseRows = buildTableDisplayRows(
      options.tasks.value,
      options.collapsedParentIds.value,
      resolveOrphanParentLabel(),
      resolveOrphanParentSortOrder(),
    )
    const rowIndex = baseRows.findIndex(row => row.task.id === taskId)
    if (rowIndex < 0) {
      return
    }
    handle.setPointerCapture(event.pointerId)
    const { block, indices } = getTableDragBlock(
      baseRows,
      rowIndex,
      options.tasks.value,
      options.collapsedParentIds.value,
    )
    if (!block.length) {
      handle.releasePointerCapture(event.pointerId)
      return
    }
    const ghostBlock = getTableDragGhostBlock(block)
    const ghostTaskIds = new Set(ghostBlock.map(row => row.task.id))
    const blockTaskIds = ghostTaskIds
    const reparentedChildIds = new Set<number>()
    if (block.length === 1 && block[0]!.kind === 'child') {
      reparentedChildIds.add(block[0]!.task.id)
    }
    const collapsedParentDrag = block[0]?.kind === 'parent'
      && options.collapsedParentIds.value.has(block[0]!.task.id)
    const anchorRow = handle.closest('tr')
    dragSession = {
      sourceIndex: indices[0] ?? rowIndex,
      pointerId: event.pointerId,
      blockTaskIds,
      ghostBlock,
      reparentedChildIds,
      captureEl: handle,
      baseRows,
      collapsedParentDrag,
      activated: false,
      startX: event.clientX,
      startY: event.clientY,
      anchorRow,
    }
    document.addEventListener('pointermove', onDocumentPointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', onDocumentPointerUp, { capture: true })
    document.addEventListener('pointercancel', onDocumentPointerUp, { capture: true })
  }
  function shouldSuppressClick (): boolean {
    return suppressClick || dragging.value
  }
  onBeforeUnmount(() => {
    detachDragListeners()
    document.body.style.userSelect = ''
    resetDragState()
  })
  return {
    dragging,
    activeRows,
    draggingTaskIds,
    onDragHandlePointerDown,
    shouldSuppressClick,
  }
}
