export type WbsColumnKey =
  | 'title'
  | 'assignees'
  | 'labels'
  | 'list'
  | 'startDate'
  | 'dueDate'
  | 'effort'
  | 'notes'
export type WbsDisplayItemKey = WbsColumnKey | 'gantt'
export type WbsColumnDef = {
  key: WbsColumnKey
  label: string
  defaultRatio: number
}
export type WbsDisplayItemDef = {
  key: WbsDisplayItemKey
  label: string
}
/** ドラッグハンドル列の幅（WBS先頭の固定列） */
export const WBS_DRAG_COL_WIDTH = 36
/** 各列の最小幅（タスク名・日付列以外） */
export const WBS_COLUMN_MIN_WIDTH = 72
/** タスク名列の最小幅 */
export const WBS_TITLE_COLUMN_MIN_WIDTH = 168
/** 開始日・終了日列の最小幅（MM/DD（曜）が切れない幅） */
export const WBS_DATE_COLUMN_MIN_WIDTH = 132
export const WBS_COLUMNS: readonly WbsColumnDef[] = [
  { key: 'title', label: 'タスク', defaultRatio: 0.16 },
  { key: 'assignees', label: '担当者', defaultRatio: 0.10 },
  { key: 'labels', label: 'ラベル', defaultRatio: 0.13 },
  { key: 'list', label: 'リスト', defaultRatio: 0.10 },
  { key: 'startDate', label: '開始日', defaultRatio: 0.11 },
  { key: 'dueDate', label: '終了日', defaultRatio: 0.11 },
  { key: 'effort', label: '工数', defaultRatio: 0.07 },
  { key: 'notes', label: '説明', defaultRatio: 0.22 },
] as const
/** 表示項目モーダル用。順序固定（ガントチャートは末尾）。 */
export const WBS_DISPLAY_ITEMS: readonly WbsDisplayItemDef[] = [
  ...WBS_COLUMNS.map(column => ({ key: column.key as WbsDisplayItemKey, label: column.label })),
  { key: 'gantt', label: 'ガントチャート' },
]
const WBS_DISPLAY_ITEM_KEY_SET = new Set<WbsDisplayItemKey>(
  WBS_DISPLAY_ITEMS.map(item => item.key),
)
export function defaultVisibleColumnKeys (): WbsDisplayItemKey[] {
  return WBS_DISPLAY_ITEMS.map(item => item.key)
}
/** 保存済みの表示項目を読み込み。順序は WBS_DISPLAY_ITEMS 固定。タスク列は常に含める。 */
export function parseStoredVisibleColumns (raw: string | null): WbsDisplayItemKey[] | null {
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
    const selected = new Set<WbsDisplayItemKey>(['title'])
    for (const item of keys) {
      if (typeof item === 'string' && WBS_DISPLAY_ITEM_KEY_SET.has(item as WbsDisplayItemKey)) {
        selected.add(item as WbsDisplayItemKey)
      }
    }
    // 旧形式（配列のみ）にはガント未対応だったため、移行時は表示ONにする
    if (legacyArray) {
      selected.add('gantt')
    }
    const ordered = WBS_DISPLAY_ITEMS.map(item => item.key).filter(key => selected.has(key))
    return ordered.length ? ordered : null
  } catch {
    return null
  }
}
export function serializeVisibleColumns (keys: WbsDisplayItemKey[]): string {
  const selected = new Set(keys)
  selected.add('title')
  const ordered = WBS_DISPLAY_ITEMS.map(item => item.key).filter(key => selected.has(key))
  return JSON.stringify({ v: 1, keys: ordered })
}
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
  if (key === 'title') {
    return WBS_TITLE_COLUMN_MIN_WIDTH
  }
  if (key === 'startDate' || key === 'dueDate') {
    return WBS_DATE_COLUMN_MIN_WIDTH
  }
  return WBS_COLUMN_MIN_WIDTH
}
function clampColumnWidth (key: WbsColumnKey, width: number): number {
  return Math.max(minWidthForColumn(key), Math.round(width))
}
function createDefaultWidths (containerWidth = DEFAULT_CONTAINER_WIDTH): WbsColumnWidths {
  const widths = {} as WbsColumnWidths
  for (const column of WBS_COLUMNS) {
    widths[column.key] = clampColumnWidth(column.key, containerWidth * column.defaultRatio)
  }
  return widths
}
function parseStoredWidths (raw: string | null): WbsColumnWidths | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<WbsColumnWidths>
    const widths = {} as WbsColumnWidths
    for (const column of WBS_COLUMNS) {
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
  return WBS_COLUMNS.findIndex(column => column.key === key)
}
export function useWbsColumnResize (
  storageKey: MaybeRefOrGetter<string>,
  options?: {
    leadingColWidth?: MaybeRefOrGetter<number>
  },
) {
  const resolveLeadingColWidth = () => toValue(options?.leadingColWidth ?? WBS_DRAG_COL_WIDTH)
  const columnWidths = ref<WbsColumnWidths>(createDefaultWidths())
  const isResizing = ref(false)
  const activeResize = ref<ResizeSession | null>(null)
  const wbsWidth = computed(() => (
    resolveLeadingColWidth()
    + WBS_COLUMNS.reduce((sum, column) => sum + columnWidths.value[column.key], 0)
  ))
  const columnResizeBoundaries = computed(() => {
    let offset = resolveLeadingColWidth()
    return WBS_COLUMNS.map((column) => {
      offset += columnWidths.value[column.key]
      return {
        columnKey: column.key,
        offset,
      }
    })
  })
  function legacyStorageKey (key: string): string | null {
    if (key.startsWith('wbs-column-widths:')) {
      return `table-column-widths:${key.slice('wbs-column-widths:'.length)}`
    }
    return null
  }
  function readStoredWidthsRaw (key: string): string | null {
    const current = localStorage.getItem(key)
    if (current != null) {
      return current
    }
    const legacyKey = legacyStorageKey(key)
    if (!legacyKey) {
      return null
    }
    const legacy = localStorage.getItem(legacyKey)
    if (legacy == null) {
      return null
    }
    localStorage.setItem(key, legacy)
    return legacy
  }
  function persistWidths () {
    if (!import.meta.client) return
    localStorage.setItem(toValue(storageKey), JSON.stringify(columnWidths.value))
  }
  function loadWidths (containerWidth?: number) {
    if (!import.meta.client) {
      columnWidths.value = createDefaultWidths(containerWidth)
      return
    }
    const stored = parseStoredWidths(readStoredWidthsRaw(toValue(storageKey)))
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
    return WBS_COLUMNS[index - 1]!.key
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
    wbsWidth,
    columnResizeBoundaries,
    isResizing,
    loadWidths,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
    onResizePointerCancel,
  }
}
