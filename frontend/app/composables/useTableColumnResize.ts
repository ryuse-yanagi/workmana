export type TableColumnKey =
  | 'title'
  | 'assignees'
  | 'labels'
  | 'list'
  | 'startDate'
  | 'dueDate'
  | 'effort'
  | 'notes'
export type TableDisplayItemKey = TableColumnKey | 'gantt'
export type TableColumnDef = {
  key: TableColumnKey
  label: string
  defaultRatio: number
}
export type TableDisplayItemDef = {
  key: TableDisplayItemKey
  label: string
}
/** ドラッグハンドル列の幅（テーブル先頭の固定列） */
export const TABLE_DRAG_COL_WIDTH = 36
/** 各列の最小幅（タスク名列以外） */
export const TABLE_COLUMN_MIN_WIDTH = 72
/** タスク名列の最小幅 */
export const TABLE_TITLE_COLUMN_MIN_WIDTH = 168
export const TABLE_COLUMNS: readonly TableColumnDef[] = [
  { key: 'title', label: 'タスク', defaultRatio: 0.16 },
  { key: 'assignees', label: '担当者', defaultRatio: 0.10 },
  { key: 'labels', label: 'ラベル', defaultRatio: 0.14 },
  { key: 'list', label: 'リスト', defaultRatio: 0.11 },
  { key: 'startDate', label: '開始日', defaultRatio: 0.09 },
  { key: 'dueDate', label: '終了日', defaultRatio: 0.09 },
  { key: 'effort', label: '工数', defaultRatio: 0.07 },
  { key: 'notes', label: '説明', defaultRatio: 0.24 },
] as const
/** 表示項目モーダル用。順序固定（ガントチャートは末尾）。 */
export const TABLE_DISPLAY_ITEMS: readonly TableDisplayItemDef[] = [
  ...TABLE_COLUMNS.map(column => ({ key: column.key as TableDisplayItemKey, label: column.label })),
  { key: 'gantt', label: 'ガントチャート' },
]
const TABLE_DISPLAY_ITEM_KEY_SET = new Set<TableDisplayItemKey>(
  TABLE_DISPLAY_ITEMS.map(item => item.key),
)
export function defaultVisibleColumnKeys (): TableDisplayItemKey[] {
  return TABLE_DISPLAY_ITEMS.map(item => item.key)
}
/** 保存済みの表示項目を読み込み。順序は TABLE_DISPLAY_ITEMS 固定。タスク列は常に含める。 */
export function parseStoredVisibleColumns (raw: string | null): TableDisplayItemKey[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    let keys: unknown[]
    let legacyArray = false
    if (Array.isArray(parsed)) {
      keys = parsed
      legacyArray = true
    } else if (
      parsed
      && typeof parsed === 'object'
      && Array.isArray((parsed as { keys?: unknown }).keys)
    ) {
      keys = (parsed as { keys: unknown[] }).keys
    } else {
      return null
    }
    const selected = new Set<TableDisplayItemKey>(['title'])
    for (const item of keys) {
      if (typeof item === 'string' && TABLE_DISPLAY_ITEM_KEY_SET.has(item as TableDisplayItemKey)) {
        selected.add(item as TableDisplayItemKey)
      }
    }
    // 旧形式（配列のみ）にはガント未対応だったため、移行時は表示ONにする
    if (legacyArray) {
      selected.add('gantt')
    }
    const ordered = TABLE_DISPLAY_ITEMS.map(item => item.key).filter(key => selected.has(key))
    return ordered.length ? ordered : null
  } catch {
    return null
  }
}
export function serializeVisibleColumns (keys: TableDisplayItemKey[]): string {
  const selected = new Set(keys)
  selected.add('title')
  const ordered = TABLE_DISPLAY_ITEMS.map(item => item.key).filter(key => selected.has(key))
  return JSON.stringify({ v: 1, keys: ordered })
}
type TableColumnWidths = Record<TableColumnKey, number>
type ResizeSession = {
  columnKey: TableColumnKey
  edge: 'left' | 'right'
  pointerId: number
  startX: number
  startWidth: number
}
const DEFAULT_CONTAINER_WIDTH = 1200
function minWidthForColumn (key: TableColumnKey): number {
  return key === 'title' ? TABLE_TITLE_COLUMN_MIN_WIDTH : TABLE_COLUMN_MIN_WIDTH
}
function clampColumnWidth (key: TableColumnKey, width: number): number {
  return Math.max(minWidthForColumn(key), Math.round(width))
}
function createDefaultWidths (containerWidth = DEFAULT_CONTAINER_WIDTH): TableColumnWidths {
  const widths = {} as TableColumnWidths
  for (const column of TABLE_COLUMNS) {
    widths[column.key] = clampColumnWidth(column.key, containerWidth * column.defaultRatio)
  }
  return widths
}
function parseStoredWidths (raw: string | null): TableColumnWidths | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TableColumnWidths>
    const widths = {} as TableColumnWidths
    for (const column of TABLE_COLUMNS) {
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
function columnIndex (key: TableColumnKey): number {
  return TABLE_COLUMNS.findIndex(column => column.key === key)
}
export function useTableColumnResize (
  storageKey: MaybeRefOrGetter<string>,
  options?: {
    leadingColWidth?: MaybeRefOrGetter<number>
  },
) {
  const resolveLeadingColWidth = () => toValue(options?.leadingColWidth ?? TABLE_DRAG_COL_WIDTH)
  const columnWidths = ref<TableColumnWidths>(createDefaultWidths())
  const isResizing = ref(false)
  const activeResize = ref<ResizeSession | null>(null)
  const tableWidth = computed(() => (
    resolveLeadingColWidth()
    + TABLE_COLUMNS.reduce((sum, column) => sum + columnWidths.value[column.key], 0)
  ))
  const columnResizeBoundaries = computed(() => {
    let offset = resolveLeadingColWidth()
    return TABLE_COLUMNS.map((column) => {
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
  function setColumnWidth (key: TableColumnKey, width: number) {
    columnWidths.value = {
      ...columnWidths.value,
      [key]: clampColumnWidth(key, width),
    }
  }
  function resizeTargetForEdge (key: TableColumnKey, edge: 'left' | 'right'): TableColumnKey {
    if (edge === 'right') return key
    const index = columnIndex(key)
    if (index <= 0) return key
    return TABLE_COLUMNS[index - 1]!.key
  }
  function onResizePointerDown (
    event: PointerEvent,
    columnKey: TableColumnKey,
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
