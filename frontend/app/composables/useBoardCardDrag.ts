import type { Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'

type ListDefLike = {
  key: string
  listId: number
}

type BoardApi = {
  <T>(url: string, opts?: { method?: string, body?: unknown }): Promise<T>
}

/**
 * ボードカード（タスク）の Sortable ドラッグ＆ドロップ。
 * ハンドラ契約・DOM クラス名は WorkspaceBoard 側と同一のまま移設。
 */
export function useBoardCardDrag<TList extends ListDefLike> (options: {
  lists: Ref<TList[]>
  tasks: Ref<WorkspaceBoardTask[] | null>
  tasksByList: Record<string, WorkspaceBoardTask[]>
  error: Ref<string | null>
  slug: Ref<string> | ComputedRef<string>
  workspaceId: Ref<string> | ComputedRef<string>
  api: BoardApi
  rebuildBoardFromTasks: () => void
  load: (opts?: { refresh?: boolean }) => Promise<void>
  syncBoardPageCache: () => void
  visibleCount: (listKey: string) => number
  isTaskVisible: (task: WorkspaceBoardTask) => boolean
  closeCardMenu: () => void
  closeListMenu: () => void
  updateDropZoneScrollableState: () => void
  getListKeyAtClientX: (clientX: number) => string | null
  findListColumnByKey: (listKey: string) => HTMLElement | null
}) {
  const boardDragging = ref(false)
  const suppressTaskCardClick = ref(false)
  let boardDragPointerX = 0
  let boardDragPointerY = 0
  let boardDragTaskId: number | null = null
  /** ドラッグ中カードの表示サイズ（リスト内プレースホルダ用） */
  let boardDragCardWidthPx = 0
  let boardDragCardHeightPx = 0
  /** Sortable が確定した移動先リスト */
  let boardDragLastToListKey: string | null = null
  /** ドラッグ開始時のリスト key */
  const boardDragStartListKey = ref<string | null>(null)
  /** 他リスト上にホバー中（ソース列のプレースホルダ抑止） */
  const boardDragCrossList = ref(false)
  /** プレビュー表示先リスト（常に1列のみ） */
  const boardDragPreviewListKey = ref<string | null>(null)
  /** sortable＝カード間、tail＝一覧最下部（composer より下） */
  const boardDragPreviewMode = ref<'sortable' | 'tail' | null>(null)
  /** ドラッグ終了時フォールバック用の最終プレビュー列 */
  let boardDragStickyColumnKey: string | null = null

  /** 空リスト用の余白スタイル（ドラッグ中のソース列の見かけの空きも含む） */
  function isListColumnEmpty (listKey: string): boolean {
    const count = options.visibleCount(listKey)
    if (!boardDragging.value) {
      return count === 0
    }
    // プレビューがこの列 → カードが戻ってきた扱いで通常余白
    if (boardDragPreviewListKey.value === listKey) {
      return false
    }
    // ソース列から他列へプレビュー移動中（最後の1枚を運んでいるとき）
    if (
      boardDragStartListKey.value === listKey
      && boardDragCrossList.value
    ) {
      if (count === 0) {
        return true
      }
      if (count === 1 && boardDragTaskId != null) {
        return (options.tasksByList[listKey] ?? []).some(
          t => t.id === boardDragTaskId && options.isTaskVisible(t),
        )
      }
    }
    return count === 0
  }

  function getTaskIdFromDragEl (el: HTMLElement): number | null {
    const raw = el.dataset.taskId
      ?? el.closest('.task-card')?.getAttribute('data-task-id')
    if (!raw) {
      return null
    }
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  }

  async function updateTaskList (taskId: number, listId: number) {
    return await options.api<WorkspaceBoardTask>(
      `/orgs/${options.slug.value}/workspaces/${options.workspaceId.value}/tasks/${taskId}`,
      {
        method: 'PATCH',
        body: { list_id: listId },
      },
    )
  }

  async function persistListTaskOrder (listKey: string) {
    const list = options.lists.value.find(l => l.key === listKey)
    if (!list) {
      return
    }
    const taskIds = (options.tasksByList[listKey] ?? []).map(t => t.id)
    await options.api<{ data: { ok: boolean } }>(
      `/orgs/${options.slug.value}/workspaces/${options.workspaceId.value}/lists/${list.listId}/tasks/reorder`,
      {
        method: 'PATCH',
        body: { task_ids: taskIds },
      },
    )
    taskIds.forEach((id, index) => {
      const task = options.tasks.value?.find(t => t.id === id)
      if (task) {
        task.sort_order = index
      }
    })
  }

  function getDropZoneListKey (dropZone: HTMLElement): string | null {
    return dropZone.closest('.list-column[data-list-key]')?.getAttribute('data-list-key') ?? null
  }

  function syncBoardDragPointer (originalEvent?: Event) {
    if (originalEvent instanceof MouseEvent || originalEvent instanceof PointerEvent) {
      boardDragPointerX = originalEvent.clientX
      boardDragPointerY = originalEvent.clientY
    }
    if (boardDragging.value) {
      syncBoardPreviewState()
    }
  }

  /** ドラッグ中ポインタが属するリスト（列間ギャップ含め中点で一意に決定） */
  function getHoverListKey (originalEvent?: Event): string | null {
    syncBoardDragPointer(originalEvent)
    return options.getListKeyAtClientX(boardDragPointerX)
  }

  /** composer より下、または列の白枠より下＝末尾ドロップ帯 */
  function isPointerInListTailZone (listColumn: HTMLElement): boolean {
    const colBottom = listColumn.getBoundingClientRect().bottom
    const composer = listColumn.querySelector('.composer')
    if (composer instanceof HTMLElement) {
      const composerBottom = composer.getBoundingClientRect().bottom
      if (boardDragPointerY >= composerBottom - 8) {
        return true
      }
    }
    return boardDragPointerY >= colBottom - 8
  }

  /** ドラッグ中プレビューを1つに統一（sortable か末尾スロットか） */
  function syncBoardPreviewState () {
    if (!boardDragging.value) {
      boardDragPreviewListKey.value = null
      boardDragPreviewMode.value = null
      return
    }
    const clientX = boardDragPointerX
    const listKey = options.getListKeyAtClientX(clientX)
      ?? boardDragStickyColumnKey
      ?? boardDragStartListKey.value
    if (!listKey) {
      boardDragPreviewListKey.value = null
      boardDragPreviewMode.value = null
      return
    }
    const listColumn = options.findListColumnByKey(listKey)
    if (!listColumn) {
      boardDragPreviewListKey.value = null
      boardDragPreviewMode.value = null
      return
    }
    boardDragLastToListKey = listKey
    boardDragStickyColumnKey = listKey
    // 空リストは Sortable ゴーストが隣列と奪い合うため常に末尾スロットのみ
    const useTailPreview = isListColumnEmpty(listKey)
      || isPointerInListTailZone(listColumn)
    if (useTailPreview) {
      boardDragPreviewListKey.value = listKey
      boardDragPreviewMode.value = 'tail'
      if (boardDragStartListKey.value && listKey !== boardDragStartListKey.value) {
        boardDragCrossList.value = true
      } else if (boardDragStartListKey.value && listKey === boardDragStartListKey.value) {
        boardDragCrossList.value = false
      }
      removeStraySortableGhosts()
      scheduleSyncDragPlaceholderSize()
      return
    }
    boardDragPreviewMode.value = 'sortable'
    boardDragPreviewListKey.value = listKey
    if (boardDragStartListKey.value && listKey !== boardDragStartListKey.value) {
      boardDragCrossList.value = true
    } else if (boardDragStartListKey.value && listKey === boardDragStartListKey.value) {
      boardDragCrossList.value = false
    }
    scheduleSyncDragPlaceholderSize()
  }

  /** プレビュー先以外・空リストの Sortable ゴーストを除去（二重・左右ちらつき防止） */
  function removeStraySortableGhosts () {
    if (!import.meta.client || !boardDragging.value) {
      return
    }
    const canonical = boardDragPreviewListKey.value ?? options.getListKeyAtClientX(boardDragPointerX)
    const tailMode = boardDragPreviewMode.value === 'tail'
    document.querySelectorAll('.list-drop-zone > .sortable-ghost').forEach((el) => {
      if (el.classList.contains('drag-ghost--tail-preview')) {
        return
      }
      const listKey = el.closest('.list-column[data-list-key]')?.getAttribute('data-list-key')
      const stray = tailMode
        || !canonical
        || !listKey
        || listKey !== canonical
        || isListColumnEmpty(listKey)
      if (stray) {
        el.remove()
      }
    })
  }

  function updateBoardDragPointer (clientX: number, clientY: number) {
    boardDragPointerX = clientX
    boardDragPointerY = clientY
    syncBoardPreviewState()
  }

  function onBoardDragPointerMove (event: PointerEvent | MouseEvent) {
    updateBoardDragPointer(event.clientX, event.clientY)
    removeStraySortableGhosts()
    syncDragElementSizes()
  }

  function onBoardNativeDragOver (event: DragEvent) {
    updateBoardDragPointer(event.clientX, event.clientY)
    event.preventDefault()
  }

  function findUniqueListKeyForTask (taskId: number): string | null {
    let found: string | null = null
    for (const list of options.lists.value) {
      if (options.tasksByList[list.key]?.some(t => t.id === taskId)) {
        if (found !== null) {
          return null
        }
        found = list.key
      }
    }
    return found
  }

  function reconcileTaskPlacement (taskId: number, canonicalListKey: string) {
    for (const list of options.lists.value) {
      if (list.key === canonicalListKey) {
        continue
      }
      const arr = options.tasksByList[list.key]
      if (!arr?.length) {
        continue
      }
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i]?.id === taskId) {
          arr.splice(i, 1)
        }
      }
    }
    const task = options.tasks.value?.find(t => t.id === taskId)
    const canonical = options.tasksByList[canonicalListKey]
    if (task && canonical && !canonical.some(t => t.id === taskId)) {
      canonical.push(task)
    }
  }

  async function persistTaskListChange (taskId: number, listKey: string) {
    const list = options.lists.value.find(l => l.key === listKey)
    const task = options.tasks.value?.find(t => t.id === taskId)
    if (!list || !task || task.list_id === list.listId) {
      return
    }
    const prevListId = task.list_id
    task.list_id = list.listId
    try {
      await updateTaskList(taskId, list.listId)
    } catch (e: unknown) {
      task.list_id = prevListId
      options.rebuildBoardFromTasks()
      options.error.value = e instanceof Error ? e.message : '移動の保存に失敗しました'
      throw e
    }
  }

  async function finalizeBoardDrag (
    taskId: number,
    canonicalListKey: string | null,
    startListKey: string | null,
    appendToEnd = false,
  ) {
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const task = options.tasks.value?.find(t => t.id === taskId)
    if (!task) {
      return
    }
    const listKey = canonicalListKey ?? findUniqueListKeyForTask(taskId)
    if (!listKey) {
      return
    }
    if (appendToEnd) {
      for (const list of options.lists.value) {
        const arr = options.tasksByList[list.key]
        if (!arr?.length) {
          continue
        }
        const idx = arr.findIndex(t => t.id === taskId)
        if (idx > -1) {
          arr.splice(idx, 1)
        }
      }
      if (!options.tasksByList[listKey]) {
        options.tasksByList[listKey] = []
      }
      options.tasksByList[listKey].push(task)
    }
    try {
      await persistTaskListChange(taskId, listKey)
    } catch {
      return
    }
    reconcileTaskPlacement(taskId, listKey)
    const listKeysToPersist = new Set<string>([listKey])
    if (startListKey && startListKey !== listKey) {
      listKeysToPersist.add(startListKey)
    }
    for (const key of listKeysToPersist) {
      try {
        await persistListTaskOrder(key)
      } catch (e: unknown) {
        options.error.value = e instanceof Error ? e.message : '並び順の保存に失敗しました'
        await options.load({ refresh: true })
        return
      }
    }
    options.syncBoardPageCache()
  }

  /**
   * プレビューは常に1つ: 末尾帯はカスタムスロットのみ、それ以外は Sortable に任せる。
   */
  function onBoardDragMove (
    evt: { to: HTMLElement, from: HTMLElement },
    originalEvent?: Event,
  ): boolean {
    syncBoardDragPointer(originalEvent)
    if (boardDragPreviewMode.value === 'tail') {
      removeStraySortableGhosts()
      return false
    }
    const canonicalListKey = boardDragPreviewListKey.value ?? options.getListKeyAtClientX(boardDragPointerX)
    const toListKey = getDropZoneListKey(evt.to)
    if (
      !canonicalListKey
      || !toListKey
      || toListKey !== canonicalListKey
      || isListColumnEmpty(toListKey)
    ) {
      removeStraySortableGhosts()
      return false
    }
    const startListKey = boardDragStartListKey.value
    if (startListKey && toListKey === startListKey && boardDragCrossList.value) {
      return false
    }
    return true
  }

  function measureDragCardSize (el: HTMLElement) {
    // offset* はレイアウト上の整数 px。rect の切り上げは 1px だけ縮む原因になるため使わない
    return {
      width: el.offsetWidth,
      height: el.offsetHeight,
    }
  }

  function captureBoardDragCardSize (sourceEl: HTMLElement) {
    const measured = measureDragCardSize(sourceEl)
    boardDragCardWidthPx = Math.max(boardDragCardWidthPx, measured.width)
    boardDragCardHeightPx = Math.max(boardDragCardHeightPx, measured.height)
  }

  const DRAG_SIZE_LOCK_PROPS = [
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'boxSizing',
    'overflow',
    'flexShrink',
  ] as const

  function applyComputedStyleSubset (from: Element, to: HTMLElement) {
    const cs = getComputedStyle(from)
    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'lineHeight', 'letterSpacing', 'wordSpacing',
      'textTransform', 'fontVariant',
      'overflowWrap', 'wordBreak', 'whiteSpace',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'color',
    ] as const
    for (const prop of props) {
      const value = cs[prop]
      if (typeof value === 'string' && value) {
        to.style.setProperty(prop.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`), value)
      }
    }
  }

  function ensureFallbackVisible (fallback: HTMLElement) {
    fallback.classList.remove('drag-ghost')
    fallback.style.setProperty('opacity', '1', 'important')
    fallback.style.setProperty('visibility', 'visible', 'important')
    fallback.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.setProperty('visibility', 'visible', 'important')
      el.style.setProperty('opacity', '1', 'important')
    })
  }

  /** body 上の fallback は scoped CSS の継承外になるため、元カードの typography を複製する */
  function syncFallbackFromSource (fallback: HTMLElement) {
    if (boardDragTaskId == null) {
      return
    }
    const source = document.querySelector<HTMLElement>(`.task-card[data-task-id="${boardDragTaskId}"]`)
    if (!source) {
      ensureFallbackVisible(fallback)
      lockDragElementSize(fallback)
      return
    }
    fallback.classList.remove('drag-ghost')
    const nestedPairs = [
      '.task-card-body',
      '.task-parent-title',
      '.task-title',
      '.task-card-meta',
      '.task-card-meta__row',
      '.task-label-list',
      '.task-label-list__strip',
      '.label-strip',
      '.task-card-footer',
      '.task-card-members',
    ] as const
    for (const selector of nestedPairs) {
      const fromEl = source.querySelector<HTMLElement>(selector)
      const toEl = fallback.querySelector<HTMLElement>(selector)
      if (fromEl && toEl) {
        applyComputedStyleSubset(fromEl, toEl)
      }
    }
    fallback.querySelectorAll<HTMLElement>('.card-menu-wrap').forEach((el) => {
      el.style.display = 'none'
    })
    lockDragElementSize(fallback)
    ensureFallbackVisible(fallback)
  }

  /** ドラッグ開始時の実寸を width/height/min/max すべてに固定し、リサイズを防ぐ */
  function lockDragElementSize (el: HTMLElement) {
    const w = boardDragCardWidthPx
    const h = boardDragCardHeightPx
    if (w <= 0 || h <= 0) {
      return
    }
    const pxW = `${w}px`
    const pxH = `${h}px`
    const important = 'important'
    el.style.setProperty('box-sizing', 'border-box', important)
    el.style.setProperty('width', pxW, important)
    el.style.setProperty('height', pxH, important)
    el.style.setProperty('min-width', pxW, important)
    el.style.setProperty('min-height', pxH, important)
    el.style.setProperty('max-width', pxW, important)
    el.style.setProperty('max-height', pxH, important)
    el.style.setProperty('flex-shrink', '0', important)
  }

  function syncDragElementSizes () {
    if (!import.meta.client || !boardDragging.value) {
      return
    }
    document.querySelectorAll<HTMLElement>(
      '.drag-ghost--tail-preview, .list-drop-zone .sortable-ghost',
    ).forEach(lockDragElementSize)
    document.querySelectorAll<HTMLElement>('.task-card.sortable-fallback').forEach((fallback) => {
      syncFallbackFromSource(fallback)
    })
  }

  function scheduleSyncDragPlaceholderSize () {
    if (!import.meta.client || !boardDragging.value) {
      return
    }
    const apply = () => syncDragElementSizes()
    nextTick(apply)
    requestAnimationFrame(apply)
    requestAnimationFrame(() => requestAnimationFrame(apply))
  }

  function clearDragPlaceholderSize () {
    if (!import.meta.client) {
      return
    }
    document.querySelectorAll<HTMLElement>(
      '.drag-ghost--tail-preview, .list-drop-zone .sortable-ghost, .task-card.sortable-fallback',
    ).forEach((el) => {
      for (const prop of DRAG_SIZE_LOCK_PROPS) {
        el.style[prop] = ''
      }
    })
    boardDragCardWidthPx = 0
    boardDragCardHeightPx = 0
  }

  function syncFloatingDragCardLayout () {
    scheduleSyncDragPlaceholderSize()
  }

  /** Sortable がゴースト生成前の素のカード寸法を記録する */
  function onBoardDragChoose (evt: { item: HTMLElement }) {
    boardDragCardWidthPx = 0
    boardDragCardHeightPx = 0
    captureBoardDragCardSize(evt.item)
  }

  function onBoardDragStart (evt: { item: HTMLElement, originalEvent?: Event }) {
    options.updateDropZoneScrollableState()
    boardDragTaskId = getTaskIdFromDragEl(evt.item)
    const task = options.tasks.value?.find(t => t.id === boardDragTaskId)
    boardDragStartListKey.value = task?.list_id != null ? `list_${task.list_id}` : null
    boardDragCrossList.value = false
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    boardDragLastToListKey = boardDragStartListKey.value
    syncBoardDragPointer(evt.originalEvent)
    captureBoardDragCardSize(evt.item)
    boardDragging.value = true
    boardDragStickyColumnKey = boardDragStartListKey.value
    options.closeCardMenu()
    options.closeListMenu()
    syncFloatingDragCardLayout()
    nextTick(() => {
      captureBoardDragCardSize(evt.item)
      syncDragElementSizes()
    })
    requestAnimationFrame(() => {
      captureBoardDragCardSize(evt.item)
      syncDragElementSizes()
    })
    if (import.meta.client) {
      document.addEventListener('pointermove', onBoardDragPointerMove, { passive: true })
      document.addEventListener('mousemove', onBoardDragPointerMove, { passive: true })
      document.addEventListener('dragover', onBoardNativeDragOver)
    }
  }

  /** ドラッグ終了時に表示位置と list_id を揃えて API 保存する */
  function onBoardDragEnd (evt?: { originalEvent?: Event }) {
    syncBoardDragPointer(evt?.originalEvent)
    syncBoardPreviewState()
    const taskId = boardDragTaskId
    const startListKey = boardDragStartListKey.value
    const previewMode = boardDragPreviewMode.value
    const toListKey = boardDragPreviewListKey.value
      ?? boardDragLastToListKey
      ?? getHoverListKey(evt?.originalEvent)
      ?? boardDragStickyColumnKey
      ?? findUniqueListKeyForTask(taskId ?? -1)
    const appendToEnd = previewMode === 'tail'
    boardDragging.value = false
    suppressTaskCardClick.value = true
    window.setTimeout(() => {
      suppressTaskCardClick.value = false
    }, 100)
    clearDragPlaceholderSize()
    boardDragTaskId = null
    boardDragCrossList.value = false
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    removeStraySortableGhosts()
    options.updateDropZoneScrollableState()
    boardDragLastToListKey = null
    boardDragStartListKey.value = null
    boardDragStickyColumnKey = null
    if (import.meta.client) {
      document.removeEventListener('pointermove', onBoardDragPointerMove)
      document.removeEventListener('mousemove', onBoardDragPointerMove)
      document.removeEventListener('dragover', onBoardNativeDragOver)
    }
    if (taskId == null || !toListKey) {
      return
    }
    void finalizeBoardDrag(taskId, toListKey, startListKey, appendToEnd)
  }

  function detachBoardCardDragListeners () {
    if (!import.meta.client) {
      return
    }
    document.removeEventListener('pointermove', onBoardDragPointerMove)
    document.removeEventListener('mousemove', onBoardDragPointerMove)
    document.removeEventListener('dragover', onBoardNativeDragOver)
  }

  return {
    boardDragging,
    suppressTaskCardClick,
    boardDragStartListKey,
    boardDragCrossList,
    boardDragPreviewListKey,
    boardDragPreviewMode,
    isListColumnEmpty,
    getTaskIdFromDragEl,
    onBoardDragMove,
    onBoardDragChoose,
    onBoardDragStart,
    onBoardDragEnd,
    onBoardDragPointerMove,
    onBoardNativeDragOver,
    detachBoardCardDragListeners,
  }
}
