import {
  WBS_COLUMNS,
  defaultVisibleColumnKeys,
  parseStoredVisibleColumns,
  serializeVisibleColumns,
  type WbsColumnKey,
  type WbsDisplayItemKey,
} from './useWbsColumnResize'

/** WBS 番号列の幅（SCSS の --wbs-code-col-width と一致） */
const WBS_CODE_COL_WIDTH = 52

function legacyVisibleColumnsStorageKey (key: string): string {
  return key.replace(/^wbs-visible-columns:/, 'table-visible-columns:')
}

function readVisibleColumnsRaw (key: string): string | null {
  const current = localStorage.getItem(key)
  if (current != null) {
    return current
  }
  const legacyKey = legacyVisibleColumnsStorageKey(key)
  if (legacyKey === key) {
    return null
  }
  const legacy = localStorage.getItem(legacyKey)
  if (legacy == null) {
    return null
  }
  localStorage.setItem(key, legacy)
  return legacy
}

export function useWbsVisibleColumns (
  storageKey: MaybeRefOrGetter<string>,
  columnWidths: MaybeRefOrGetter<Record<string, number>>,
) {
  const visibleColumnKeys = ref<WbsDisplayItemKey[]>(defaultVisibleColumnKeys())
  const displayItemsModalOpen = ref(false)
  const visibleColumnKeySet = computed(() => new Set(visibleColumnKeys.value))
  const visibleColumns = computed(() => (
    WBS_COLUMNS.filter(column => visibleColumnKeySet.value.has(column.key))
  ))
  const showGantt = computed(() => visibleColumnKeySet.value.has('gantt'))
  const lastVisibleColumnKey = computed(() => (
    visibleColumns.value[visibleColumns.value.length - 1]?.key ?? null
  ))
  const visibleWbsWidth = computed(() => (
    visibleColumns.value.reduce((sum, column) => sum + toValue(columnWidths)[column.key], 0)
  ))
  const visibleColumnResizeBoundaries = computed(() => {
    let offset = WBS_CODE_COL_WIDTH
    const widths = toValue(columnWidths)
    return visibleColumns.value.map((column) => {
      offset += widths[column.key]
      return {
        columnKey: column.key,
        // 区切り線は列右端
        offset,
      }
    })
  })

  function loadVisibleColumns () {
    if (!import.meta.client) {
      visibleColumnKeys.value = defaultVisibleColumnKeys()
      return
    }
    visibleColumnKeys.value = (
      parseStoredVisibleColumns(readVisibleColumnsRaw(toValue(storageKey)))
      ?? defaultVisibleColumnKeys()
    )
  }

  function persistVisibleColumns () {
    if (!import.meta.client) return
    localStorage.setItem(toValue(storageKey), serializeVisibleColumns(visibleColumnKeys.value))
  }

  function isColumnVisible (key: WbsColumnKey) {
    return visibleColumnKeySet.value.has(key)
  }

  function isLastVisibleColumn (key: WbsColumnKey) {
    return lastVisibleColumnKey.value === key
  }

  function isFirstVisibleColumn (key: WbsColumnKey) {
    return visibleColumns.value[0]?.key === key
  }

  function openDisplayItems () {
    displayItemsModalOpen.value = true
  }

  function onDisplayItemsSave (keys: WbsDisplayItemKey[]) {
    const selected = new Set(keys)
    selected.add('title')
    const ordered = defaultVisibleColumnKeys().filter(key => selected.has(key))
    if (!ordered.length) return
    visibleColumnKeys.value = ordered
    persistVisibleColumns()
  }

  watch(() => toValue(storageKey), () => {
    loadVisibleColumns()
  }, { immediate: true })

  return {
    visibleColumnKeys,
    displayItemsModalOpen,
    visibleColumnKeySet,
    visibleColumns,
    showGantt,
    lastVisibleColumnKey,
    visibleWbsWidth,
    visibleColumnResizeBoundaries,
    loadVisibleColumns,
    persistVisibleColumns,
    isColumnVisible,
    isLastVisibleColumn,
    isFirstVisibleColumn,
    openDisplayItems,
    onDisplayItemsSave,
  }
}
