import { computeWbsHeaderLabelColumnMinWidth } from '../../utils/wbs/wbsTitleColumnWidth'

export type WbsColumnKey =
  | 'title'
  | 'assignees'
  | 'labels'
  | 'list'
  | 'period'
  | 'effort'
  | 'progressRate'
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
/** 各列の最小幅（タスク名・日付列・リスト列・説明列以外） */
export const WBS_COLUMN_MIN_WIDTH = 72
/** タスク名列の最小幅 */
export const WBS_TITLE_COLUMN_MIN_WIDTH = 168
/** リスト列の最小幅（担当者・ラベル列と同程度） */
export const WBS_LIST_COLUMN_MIN_WIDTH = 85
/** 期間列の最小幅（MM/DD～MM/DD が切れない幅） */
export const WBS_DATE_COLUMN_MIN_WIDTH = 140
/** 工数列の最小幅（担当者・ラベル・リスト列と同程度） */
export const WBS_EFFORT_COLUMN_MIN_WIDTH = 100
/** 進捗率列の最小幅（工数列と同程度） */
export const WBS_PROGRESS_RATE_COLUMN_MIN_WIDTH = 100
/** 説明列の最小幅 */
export const WBS_NOTES_COLUMN_MIN_WIDTH = 180
export const WBS_COLUMNS: readonly WbsColumnDef[] = [
  { key: 'title', label: 'タスク', defaultRatio: 0.16 },
  { key: 'assignees', label: '担当者', defaultRatio: 0.10 },
  { key: 'labels', label: 'ラベル', defaultRatio: 0.13 },
  { key: 'list', label: 'リスト', defaultRatio: 0.10 },
  { key: 'period', label: '期間', defaultRatio: 0.14 },
  { key: 'effort', label: '工数', defaultRatio: 0.07 },
  { key: 'progressRate', label: '進捗率', defaultRatio: 0.07 },
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
      if (typeof item !== 'string') continue
      // 旧「開始日」「終了日」列 → 「期間」
      if (item === 'startDate' || item === 'dueDate') {
        selected.add('period')
        continue
      }
      if (WBS_DISPLAY_ITEM_KEY_SET.has(item as WbsDisplayItemKey)) {
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
function columnIndex (key: WbsColumnKey): number {
  return WBS_COLUMNS.findIndex(column => column.key === key)
}
/** 担当者・ラベル・説明だけ横幅を変えられる */
export function isResizableWbsColumn (key: WbsColumnKey): boolean {
  return key === 'assignees' || key === 'labels' || key === 'notes'
}

type FixedWbsColumnKey = 'title' | 'list' | 'period' | 'effort' | 'progressRate'

const FIXED_WIDTH_FLOORS: Record<FixedWbsColumnKey, number> = {
  title: WBS_TITLE_COLUMN_MIN_WIDTH,
  list: WBS_LIST_COLUMN_MIN_WIDTH,
  period: WBS_DATE_COLUMN_MIN_WIDTH,
  effort: WBS_EFFORT_COLUMN_MIN_WIDTH,
  progressRate: WBS_PROGRESS_RATE_COLUMN_MIN_WIDTH,
}

function createFixedColumnWidths (): Record<FixedWbsColumnKey, number> {
  return { ...FIXED_WIDTH_FLOORS }
}

export function useWbsColumnResize (
  storageKey: MaybeRefOrGetter<string>,
  options?: {
    leadingColWidth?: MaybeRefOrGetter<number>
  },
) {
  const resolveLeadingColWidth = () => toValue(options?.leadingColWidth ?? WBS_DRAG_COL_WIDTH)
  /** 内容で決まる列幅（localStorage には保存しない） */
  const fixedColumnWidths = ref(createFixedColumnWidths())
  function minWidthForColumn (key: WbsColumnKey): number {
    if (
      key === 'title'
      || key === 'list'
      || key === 'period'
      || key === 'effort'
      || key === 'progressRate'
    ) {
      return fixedColumnWidths.value[key]
    }
    if (key === 'assignees') {
      return Math.max(WBS_COLUMN_MIN_WIDTH, computeWbsHeaderLabelColumnMinWidth('担当者'))
    }
    if (key === 'labels') {
      return Math.max(WBS_COLUMN_MIN_WIDTH, computeWbsHeaderLabelColumnMinWidth('ラベル'))
    }
    if (key === 'notes') {
      return WBS_NOTES_COLUMN_MIN_WIDTH
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
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const widths = {} as WbsColumnWidths
      for (const column of WBS_COLUMNS) {
        let value = parsed[column.key]
        if (
          column.key === 'period'
          && (typeof value !== 'number' || !Number.isFinite(value))
        ) {
          const start = parsed.startDate
          const due = parsed.dueDate
          if (
            typeof start === 'number' && Number.isFinite(start)
            && typeof due === 'number' && Number.isFinite(due)
          ) {
            value = Math.max(start, due)
          } else if (typeof start === 'number' && Number.isFinite(start)) {
            value = start
          } else if (typeof due === 'number' && Number.isFinite(due)) {
            value = due
          }
        }
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
  /** 旧 localStorage キー `table-column-widths` を、いまの列幅として読む。 */
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
    const widths = stored ?? createDefaultWidths(containerWidth)
    for (const key of Object.keys(FIXED_WIDTH_FLOORS) as FixedWbsColumnKey[]) {
      widths[key] = fixedColumnWidths.value[key]
    }
    columnWidths.value = widths
  }
  function setColumnWidth (key: WbsColumnKey, width: number) {
    columnWidths.value = {
      ...columnWidths.value,
      [key]: clampColumnWidth(key, width),
    }
  }
  /** タスク名・リスト・期間・工数・進捗率は、渡した幅に固定する */
  function applyFixedColumnWidth (key: FixedWbsColumnKey, width: number) {
    const minWidth = Math.max(FIXED_WIDTH_FLOORS[key], Math.round(width))
    fixedColumnWidths.value = {
      ...fixedColumnWidths.value,
      [key]: minWidth,
    }
    setColumnWidth(key, minWidth)
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
    const targetKey = resizeTargetForEdge(columnKey, edge)
    if (!isResizableWbsColumn(targetKey)) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget as HTMLElement | null
    handle?.setPointerCapture(event.pointerId)
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
      fixedColumnWidths.value = createFixedColumnWidths()
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
    applyFixedColumnWidth,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
    onResizePointerCancel,
  }
}
