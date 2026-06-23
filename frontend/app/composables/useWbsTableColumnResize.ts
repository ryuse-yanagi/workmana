export type WbsColumnKey =
  | 'title'
  | 'assignees'
  | 'labels'
  | 'list'
  | 'startDate'
  | 'dueDate'
  | 'effort'
  | 'notes'

export type WbsTableColumnDef = {
  key: WbsColumnKey
  label: string
  defaultRatio: number
}

/** ドラッグハンドル列の幅（テーブル先頭の固定列） */
export const WBS_DRAG_COL_WIDTH = 36

/** 各列の最小幅（タスク名列以外） */
export const WBS_COLUMN_MIN_WIDTH = 72

/** タスク名列の最小幅 */
export const WBS_TITLE_COLUMN_MIN_WIDTH = 168

export const WBS_TABLE_COLUMNS: readonly WbsTableColumnDef[] = [
  { key: 'title', label: 'タスク', defaultRatio: 0.16 },
  { key: 'assignees', label: '担当者', defaultRatio: 0.10 },
  { key: 'labels', label: 'ラベル', defaultRatio: 0.14 },
  { key: 'list', label: 'リスト', defaultRatio: 0.11 },
  { key: 'startDate', label: '開始日', defaultRatio: 0.09 },
  { key: 'dueDate', label: '終了日', defaultRatio: 0.09 },
  { key: 'effort', label: '工数', defaultRatio: 0.07 },
  { key: 'notes', label: '説明', defaultRatio: 0.24 },
] as const

type WbsColumnWidths = Record<WbsColumnKey, number>

type ResizeSession = {
  columnKey: WbsColumnKey
  edge: 'left' | 'right'
  pointerId: number
  startX: number
  startWidth: number
}

const DEFAULT_CONTAINER_WIDTH = 1200

function minWidthForColumn (key: WbsColumnKey): number {
  return key === 'title' ? WBS_TITLE_COLUMN_MIN_WIDTH : WBS_COLUMN_MIN_WIDTH
}

function clampColumnWidth (key: WbsColumnKey, width: number): number {
  return Math.max(minWidthForColumn(key), Math.round(width))
}

function createDefaultWidths (containerWidth = DEFAULT_CONTAINER_WIDTH): WbsColumnWidths {
  const widths = {} as WbsColumnWidths
  for (const column of WBS_TABLE_COLUMNS) {
    widths[column.key] = clampColumnWidth(column.key, containerWidth * column.defaultRatio)
  }
  return widths
}

function parseStoredWidths (raw: string | null): WbsColumnWidths | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<WbsColumnWidths>
    const widths = {} as WbsColumnWidths
    for (const column of WBS_TABLE_COLUMNS) {
      const value = parsed[column.key]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null
      }
      widths[column.key] = clampColumnWidth(column.key, value)
    }
    return widths
  } catch {
    return null
  }
}

function columnIndex (key: WbsColumnKey): number {
  return WBS_TABLE_COLUMNS.findIndex(column => column.key === key)
}

export function useWbsTableColumnResize (storageKey: MaybeRefOrGetter<string>) {
  const columnWidths = ref<WbsColumnWidths>(createDefaultWidths())
  const isResizing = ref(false)
  const activeResize = ref<ResizeSession | null>(null)

  const tableWidth = computed(() => (
    WBS_DRAG_COL_WIDTH
    + WBS_TABLE_COLUMNS.reduce((sum, column) => sum + columnWidths.value[column.key], 0)
  ))

  const columnResizeBoundaries = computed(() => {
    let offset = WBS_DRAG_COL_WIDTH
    return WBS_TABLE_COLUMNS.map((column) => {
      offset += columnWidths.value[column.key]
      return {
        columnKey: column.key,
        offset,
      }
    })
  })

  function persistWidths () {
    if (!import.meta.client) return
    localStorage.setItem(toValue(storageKey), JSON.stringify(columnWidths.value))
  }

  function loadWidths (containerWidth?: number) {
    if (!import.meta.client) {
      columnWidths.value = createDefaultWidths(containerWidth)
      return
    }
    const stored = parseStoredWidths(localStorage.getItem(toValue(storageKey)))
    columnWidths.value = stored ?? createDefaultWidths(containerWidth)
  }

  function setColumnWidth (key: WbsColumnKey, width: number) {
    columnWidths.value = {
      ...columnWidths.value,
      [key]: clampColumnWidth(key, width),
    }
  }

  function resizeTargetForEdge (key: WbsColumnKey, edge: 'left' | 'right'): WbsColumnKey {
    if (edge === 'right') return key
    const index = columnIndex(key)
    if (index <= 0) return key
    return WBS_TABLE_COLUMNS[index - 1]!.key
  }

  function onResizePointerDown (
    event: PointerEvent,
    columnKey: WbsColumnKey,
    edge: 'left' | 'right',
  ) {
    if (edge === 'left' && columnIndex(columnKey) <= 0) return

    event.preventDefault()
    event.stopPropagation()

    const handle = event.currentTarget as HTMLElement | null
    handle?.setPointerCapture(event.pointerId)

    const targetKey = resizeTargetForEdge(columnKey, edge)
    activeResize.value = {
      columnKey: targetKey,
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: columnWidths.value[targetKey],
    }
    isResizing.value = true
  }

  function onResizePointerMove (event: PointerEvent) {
    const session = activeResize.value
    if (!session || session.pointerId !== event.pointerId) return

    event.preventDefault()
    setColumnWidth(
      session.columnKey,
      session.startWidth + (event.clientX - session.startX),
    )
  }

  function finishResize (event: PointerEvent) {
    const session = activeResize.value
    if (!session || session.pointerId !== event.pointerId) return

    const handle = event.currentTarget as HTMLElement | null
    if (handle?.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId)
    }

    activeResize.value = null
    isResizing.value = false
    persistWidths()
  }

  function onResizePointerUp (event: PointerEvent) {
    finishResize(event)
  }

  function onResizePointerCancel (event: PointerEvent) {
    finishResize(event)
  }

  watch(
    () => toValue(storageKey),
    () => {
      loadWidths()
    },
    { immediate: true },
  )

  return {
    columnWidths,
    tableWidth,
    columnResizeBoundaries,
    isResizing,
    loadWidths,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
    onResizePointerCancel,
  }
}
