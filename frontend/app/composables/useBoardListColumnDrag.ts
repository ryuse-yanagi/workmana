import type { ComputedRef, Ref } from 'vue'

type ListDefLike = {
  key: string
  title: string
  listId: number
  color: string
  color_index: number
}

type BoardApi = {
  <T>(url: string, opts?: { method?: string, body?: unknown }): Promise<T>
}

/**
 * ボードリスト列の Sortable ドラッグ＆ドロップ。
 * ハンドラ契約・DOM クラス名は WorkspaceBoard 側と同一のまま移設。
 */
export function useBoardListColumnDrag<TList extends ListDefLike> (options: {
  lists: Ref<TList[]>
  boardDragging: Ref<boolean>
  error: Ref<string | null>
  slug: Ref<string> | ComputedRef<string>
  workspaceId: Ref<string> | ComputedRef<string>
  api: BoardApi
  closeCardMenu: () => void
  closeListMenu: () => void
  updateDropZoneScrollableState: () => void
  getBoardListColumns: () => HTMLElement[]
  getListKeyAtClientX: (clientX: number) => string | null
  getListColumnHitBounds: (
    columns: HTMLElement[],
    index: number,
  ) => { left: number, right: number } | null
}) {
  const listReorderPending = ref(false)
  const listColumnDragging = ref(false)
  /** Sortable DOM と lists のズレ解消用（ドラッグ完了後にインクリメント） */
  const listSortableEpoch = ref(0)
  /** リストヘッダーのドラッグ直後にタイトル click で編集が開くのを防ぐ */
  const suppressListTitleClick = ref(false)
  let listOrderSnapshot: TList[] | null = null
  /** リスト列ドラッグ中のポインタ X（列判定は Y 非依存） */
  let listColumnDragPointerX = 0
  /** ドラッグ中のリスト列 key */
  let listColumnDragSourceKey: string | null = null
  /** ドラッグ中に最後にプレビュー反映した並び */
  let listColumnDragPreviewOrder: TList[] | null = null
  /** ドロップ確定〜Sortable 後処理までの正しい並び（プレビューと同一） */
  let listColumnDragFinalOrder: TList[] | null = null
  let listColumnDragCommitting = false
  let listColumnDragPreviewRaf = 0

  function getListColumnDragElement (): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      '.list-column.drag-active, .list-column.sortable-fallback',
    )
  }

  /** ドラッグ中リストの水平位置（浮遊要素の中心 X を優先） */
  function resolveListColumnDragProbeX (): number {
    const dragEl = getListColumnDragElement()
    if (dragEl) {
      const rect = dragEl.getBoundingClientRect()
      return rect.left + rect.width / 2
    }
    return listColumnDragPointerX
  }

  function isListColumnHitTestTarget (col: HTMLElement): boolean {
    return !col.classList.contains('drag-active')
      && !col.classList.contains('sortable-fallback')
  }

  /**
   * リスト列ドラッグ用: ポインタ X が属する画面上の列スロット index。
   * 列の実幅内を優先し、列間ギャップは隣接列の中点で帰属する。
   */
  function getListColumnVisualIndexAtClientX (clientX: number): number | null {
    const columns = options.getBoardListColumns()
    if (!columns.length) {
      return null
    }
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (!col || !isListColumnHitTestTarget(col)) {
        continue
      }
      const rect = col.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        return i
      }
    }
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (!col || !isListColumnHitTestTarget(col)) {
        continue
      }
      const bounds = options.getListColumnHitBounds(columns, i)
      if (bounds && clientX >= bounds.left && clientX <= bounds.right) {
        return i
      }
    }
    const fallbackKey = options.getListKeyAtClientX(clientX)
    if (!fallbackKey) {
      return null
    }
    const idx = columns.findIndex(
      col => isListColumnHitTestTarget(col) && col.dataset.listKey === fallbackKey,
    )
    return idx === -1 ? null : idx
  }

  function lockListColumnWidthsForDrag () {
    if (!import.meta.client) {
      return
    }
    document.querySelectorAll('.board-lists-sortable .list-column').forEach((col) => {
      if (!(col instanceof HTMLElement)) {
        return
      }
      const w = col.getBoundingClientRect().width
      col.style.width = `${w}px`
      col.style.minWidth = `${w}px`
      col.style.maxWidth = `${w}px`
    })
  }

  function clearListColumnWidthLocks () {
    if (!import.meta.client) {
      return
    }
    document.querySelectorAll('.board-lists-sortable .list-column').forEach((col) => {
      if (!(col instanceof HTMLElement)) {
        return
      }
      col.style.width = ''
      col.style.minWidth = ''
      col.style.maxWidth = ''
    })
  }

  function moveListDefToIndex (items: TList[], sourceIdx: number, targetIdx: number): TList[] {
    if (sourceIdx === targetIdx || sourceIdx < 0 || targetIdx < 0 || sourceIdx >= items.length) {
      return items
    }
    const next = [...items]
    const [moved] = next.splice(sourceIdx, 1)
    if (!moved) {
      return items
    }
    next.splice(targetIdx, 0, moved)
    return next
  }

  function commitListColumnVisualOrder (order: TList[]) {
    options.lists.value = order.map(l => ({ ...l }))
    listSortableEpoch.value++
  }

  function listsShareOrder (a: TList[], b: TList[]): boolean {
    return a.length === b.length && a.every((l, i) => l.listId === b[i]?.listId)
  }

  function getListColumnAuthoritativeOrder (): TList[] | null {
    return listColumnDragFinalOrder ?? listColumnDragPreviewOrder
  }

  /** Sortable が独自に splice した場合、プレビューと同じ並びへ戻す */
  function enforceListColumnAuthoritativeOrder () {
    const authoritative = getListColumnAuthoritativeOrder()
    if (!authoritative || listsShareOrder(options.lists.value, authoritative)) {
      return
    }
    options.lists.value = authoritative.map(l => ({ ...l }))
  }

  function onListColumnSortableChange () {
    if (listColumnDragging.value || listColumnDragCommitting) {
      enforceListColumnAuthoritativeOrder()
    }
  }

  function syncListColumnDragPointer (originalEvent?: Event) {
    if (originalEvent instanceof MouseEvent || originalEvent instanceof PointerEvent) {
      listColumnDragPointerX = originalEvent.clientX
    }
  }

  /** ドラッグ要素の水平位置でリスト列の配置プレビューを同期 */
  function syncListColumnDragPreview () {
    if (!listColumnDragging.value || !listColumnDragSourceKey) {
      return
    }
    const probeX = resolveListColumnDragProbeX()
    const visualInsertIdx = getListColumnVisualIndexAtClientX(probeX)
    if (visualInsertIdx === null) {
      return
    }
    const current = options.lists.value
    const sourceIdx = current.findIndex(l => l.key === listColumnDragSourceKey)
    if (sourceIdx === -1) {
      return
    }
    if (sourceIdx !== visualInsertIdx) {
      const next = moveListDefToIndex(current, sourceIdx, visualInsertIdx)
      if (next !== current) {
        options.lists.value = next
      }
    }
    listColumnDragPreviewOrder = options.lists.value.map(l => ({ ...l }))
  }

  function scheduleListColumnDragPreview () {
    if (!import.meta.client || listColumnDragPreviewRaf) {
      return
    }
    listColumnDragPreviewRaf = window.requestAnimationFrame(() => {
      listColumnDragPreviewRaf = 0
      syncListColumnDragPreview()
    })
  }

  function onListColumnDragPointerMove (event: PointerEvent | MouseEvent) {
    listColumnDragPointerX = event.clientX
    scheduleListColumnDragPreview()
  }

  function onListColumnNativeDragOver (event: DragEvent) {
    listColumnDragPointerX = event.clientX
    scheduleListColumnDragPreview()
    event.preventDefault()
  }

  function detachListColumnDragListeners () {
    if (!import.meta.client) {
      return
    }
    document.removeEventListener('pointermove', onListColumnDragPointerMove)
    document.removeEventListener('mousemove', onListColumnDragPointerMove)
    document.removeEventListener('dragover', onListColumnNativeDragOver)
    if (listColumnDragPreviewRaf) {
      window.cancelAnimationFrame(listColumnDragPreviewRaf)
      listColumnDragPreviewRaf = 0
    }
  }

  function onListColumnDragMove (
    _evt: { related: HTMLElement },
    originalEvent?: Event,
  ): boolean {
    syncListColumnDragPointer(originalEvent)
    scheduleListColumnDragPreview()
    return false
  }

  function onListColumnDragStart (evt: { item: HTMLElement, originalEvent?: Event }) {
    if (options.boardDragging.value) {
      return
    }
    suppressListTitleClick.value = false
    listColumnDragging.value = true
    listColumnDragSourceKey = evt.item.dataset.listKey ?? null
    listColumnDragFinalOrder = null
    listColumnDragCommitting = false
    syncListColumnDragPointer(evt.originalEvent)
    options.closeCardMenu()
    options.closeListMenu()
    listOrderSnapshot = options.lists.value.map(l => ({ ...l }))
    listColumnDragPreviewOrder = options.lists.value.map(l => ({ ...l }))
    lockListColumnWidthsForDrag()
    nextTick(() => lockListColumnWidthsForDrag())
    if (import.meta.client) {
      document.addEventListener('pointermove', onListColumnDragPointerMove, { passive: true })
      document.addEventListener('mousemove', onListColumnDragPointerMove, { passive: true })
      document.addEventListener('dragover', onListColumnNativeDragOver)
    }
    scheduleListColumnDragPreview()
  }

  async function onListColumnDragEnd () {
    if (listColumnDragPreviewRaf) {
      window.cancelAnimationFrame(listColumnDragPreviewRaf)
      listColumnDragPreviewRaf = 0
    }
    // ドロップ時は DOM が遷移するため再同期しない。直前のプレビュー並びをそのまま確定する。
    const finalOrder = (listColumnDragPreviewOrder ?? options.lists.value).map(l => ({ ...l }))
    const snapshot = listOrderSnapshot
    listColumnDragFinalOrder = finalOrder.map(l => ({ ...l }))
    listColumnDragCommitting = true
    enforceListColumnAuthoritativeOrder()
    detachListColumnDragListeners()
    listColumnDragPreviewOrder = null
    listColumnDragSourceKey = null
    listColumnDragging.value = false
    listOrderSnapshot = null
    clearListColumnWidthLocks()
    options.updateDropZoneScrollableState()
    commitListColumnVisualOrder(finalOrder)
    await nextTick()
    enforceListColumnAuthoritativeOrder()
    commitListColumnVisualOrder(finalOrder)
    listColumnDragFinalOrder = null
    listColumnDragCommitting = false
    if (!snapshot) {
      return
    }
    const unchanged = snapshot.length === finalOrder.length
      && snapshot.every((l, i) => l.listId === finalOrder[i]?.listId)
    if (unchanged) {
      return
    }
    suppressListTitleClick.value = true
    window.setTimeout(() => {
      suppressListTitleClick.value = false
    }, 100)
    await persistListOrder(snapshot, finalOrder)
  }

  async function persistListOrder (rollback: TList[], committedOrder: TList[]) {
    listReorderPending.value = true
    options.error.value = null
    const listIds = committedOrder.map(l => l.listId)
    try {
      await options.api<{ data: { ok: boolean } }>(
        `/orgs/${options.slug.value}/workspaces/${options.workspaceId.value}/lists/reorder`,
        { method: 'PATCH', body: { list_ids: listIds } },
      )
      options.lists.value = committedOrder.map(l => ({ ...l }))
    } catch (e: unknown) {
      commitListColumnVisualOrder(rollback)
      options.error.value = e instanceof Error ? e.message : 'リストの並び替えに失敗しました'
    } finally {
      listReorderPending.value = false
    }
  }

  return {
    listReorderPending,
    listColumnDragging,
    listSortableEpoch,
    suppressListTitleClick,
    onListColumnSortableChange,
    onListColumnDragMove,
    onListColumnDragStart,
    onListColumnDragEnd,
    detachListColumnDragListeners,
    clearListColumnWidthLocks,
  }
}
