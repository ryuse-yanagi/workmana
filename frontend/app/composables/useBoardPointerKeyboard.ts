import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'
import { isViewShortcutModifierBlocked } from './useViewKeyboardShortcuts'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../utils/uiInteraction'

type ListDefLike = {
  key: string
  listId: number
}

type WorkspaceSidebarLike = {
  documentAddModalOpen?: boolean
  openDocumentAddModal?: () => void | Promise<void>
} | null

/**
 * ボード上のポインタ追跡とキーボードショートカット。
 */
export function useBoardPointerKeyboard<TList extends ListDefLike> (options: {
  lists: Ref<TList[]>
  tasks: Ref<WorkspaceBoardTask[] | null>
  pageReady: Ref<boolean>
  pending: Ref<boolean>
  fatalLoadError: Ref<string | null>
  taskAddOpen: Ref<boolean>
  taskDetailOpen: Ref<boolean> | ComputedRef<boolean>
  addChildTaskTransitionPending: Ref<boolean>
  archivedModalOpen: Ref<boolean>
  archivedDocumentsOpen: Ref<boolean>
  workspaceSidebarRef: Ref<WorkspaceSidebarLike>
  listFormOpen: Ref<boolean>
  listDeleteOpen: Ref<boolean>
  archiveConfirmTaskOpen: Ref<boolean> | ComputedRef<boolean>
  workspaceArchiveConfirmOpen: Ref<boolean>
  editingListKey: Ref<string | null>
  editingTaskId: Ref<number | null>
  boardDragging: Ref<boolean>
  listColumnDragging: Ref<boolean>
  subheaderMenuOpen: Ref<boolean> | ComputedRef<boolean>
  boardFilterOpen: Ref<boolean> | ComputedRef<boolean>
  isTaskVisible: (task: WorkspaceBoardTask) => boolean
  getTaskIdFromDragEl: (el: HTMLElement) => number | null
  getListKeyAtClientX: (clientX: number) => string | null
  findListColumnByKey: (listKey: string) => HTMLElement | null
  getBoardListColumns: () => HTMLElement[]
  getListColumnHitBounds: (
    columns: HTMLElement[],
    columnIndex: number,
  ) => { left: number, right: number } | null
  closeSubheaderMenu: () => void
  closeBoardFilter: () => void
  closeCardMenu: () => void
  closeListMenu: () => void
  toggleSubheaderMenu: () => void
  toggleSidebar: () => void
  isBoardFilterTriggerAvailable: () => boolean
  openBoardFilter: () => void
  openTaskDetail: (task: WorkspaceBoardTask) => void
  openTaskAddModal: (listId: number, parentTaskId?: number | null) => void
  openTaskAddFromHeader: () => void
}) {
  const {
    lists,
    tasks,
    pageReady,
    pending,
    fatalLoadError,
    taskAddOpen,
    taskDetailOpen,
    addChildTaskTransitionPending,
    archivedModalOpen,
    archivedDocumentsOpen,
    workspaceSidebarRef,
    listFormOpen,
    listDeleteOpen,
    archiveConfirmTaskOpen,
    workspaceArchiveConfirmOpen,
    editingListKey,
    editingTaskId,
    boardDragging,
    listColumnDragging,
    subheaderMenuOpen,
    boardFilterOpen,
    isTaskVisible,
    getTaskIdFromDragEl,
    getListKeyAtClientX,
    findListColumnByKey,
    getBoardListColumns,
    getListColumnHitBounds,
    closeSubheaderMenu,
    closeBoardFilter,
    closeCardMenu,
    closeListMenu,
    toggleSubheaderMenu,
    toggleSidebar,
    isBoardFilterTriggerAvailable,
    openBoardFilter,
    openTaskDetail,
    openTaskAddModal,
    openTaskAddFromHeader,
  } = options

  /** キーボードショートカット用の最新ポインタ位置 */
  let boardPointerX = 0
  let boardPointerY = 0

  /** ポインタ直下の表示中タスク（カード上にカーソルがあるとき） */
  function resolvePointerTask (): WorkspaceBoardTask | null {
    if (!import.meta.client || !tasks.value) {
      return null
    }
    const hitEl = document.elementFromPoint(boardPointerX, boardPointerY)
    if (!(hitEl instanceof Element)) {
      return null
    }
    const cardEl = hitEl.closest('.task-card[data-task-id]')
    if (!(cardEl instanceof HTMLElement)) {
      return null
    }
    const taskId = getTaskIdFromDragEl(cardEl)
    if (taskId === null) {
      return null
    }
    const task = tasks.value.find(row => row.id === taskId) ?? null
    if (!task || !isTaskVisible(task)) {
      return null
    }
    return task
  }

  /** ポインタ位置が属するリスト ID（列内・列下の余白も含む） */
  function resolvePointerListId (): number | null {
    if (!import.meta.client) {
      return null
    }
    const clientX = boardPointerX
    const clientY = boardPointerY
    const hitEl = document.elementFromPoint(clientX, clientY)
    const columnFromHit = hitEl?.closest('.list-column[data-list-key]')
    if (columnFromHit instanceof HTMLElement) {
      const listKey = columnFromHit.dataset.listKey
      if (listKey) {
        return lists.value.find(list => list.key === listKey)?.listId ?? null
      }
    }
    const listKey = getListKeyAtClientX(clientX)
    if (!listKey) {
      return null
    }
    const column = findListColumnByKey(listKey)
    if (!column) {
      return null
    }
    const columns = getBoardListColumns()
    const columnIndex = columns.findIndex(col => col.dataset.listKey === listKey)
    const bounds = columnIndex >= 0 ? getListColumnHitBounds(columns, columnIndex) : null
    if (!bounds) {
      return null
    }
    const colTop = column.getBoundingClientRect().top
    if (clientX >= bounds.left && clientX <= bounds.right && clientY >= colTop) {
      return lists.value.find(list => list.key === listKey)?.listId ?? null
    }
    return null
  }

  function syncBoardPointer (event: MouseEvent | PointerEvent) {
    boardPointerX = event.clientX
    boardPointerY = event.clientY
  }

  function onBoardPointerMove (event: MouseEvent | PointerEvent) {
    syncBoardPointer(event)
  }

  function dismissBoardPopovers () {
    closeSubheaderMenu()
    closeBoardFilter()
    closeCardMenu()
    closeListMenu()
  }

  function canUseBoardKeyboardShortcut (): boolean {
    if (!pageReady.value || fatalLoadError.value) {
      return false
    }
    if (
      taskAddOpen.value
      || taskDetailOpen.value
      || addChildTaskTransitionPending.value
      || archivedModalOpen.value
      || archivedDocumentsOpen.value
      || workspaceSidebarRef.value?.documentAddModalOpen
      || listFormOpen.value
      || listDeleteOpen.value
      || archiveConfirmTaskOpen.value
      || workspaceArchiveConfirmOpen.value
      || editingListKey.value
      || editingTaskId.value
      || boardDragging.value
      || listColumnDragging.value
      || pending.value
    ) {
      return false
    }
    return !getTopmostModalOverlay()
  }

  function onBoardKeydown (event: KeyboardEvent) {
    const key = event.key
    if (key === 'Enter') {
      if (isViewShortcutModifierBlocked(event)) {
        return
      }
      if (isKeyboardShortcutBlockedTarget(event.target)) {
        return
      }
      if (!canUseBoardKeyboardShortcut()) {
        return
      }
      const task = resolvePointerTask()
      if (!task) {
        return
      }
      event.preventDefault()
      dismissBoardPopovers()
      openTaskDetail(task)
      return
    }
    const isLetterShortcut = (
      key === 'n' || key === 'N'
      || key === 'f' || key === 'F'
      || key === 'm' || key === 'M'
      || key === 's' || key === 'S'
      || key === 'd' || key === 'D'
    )
    if (!isLetterShortcut) {
      return
    }
    if (isViewShortcutModifierBlocked(event)) {
      return
    }
    if (isKeyboardShortcutBlockedTarget(event.target)) {
      return
    }
    if (key === 'm' || key === 'M') {
      if (subheaderMenuOpen.value) {
        event.preventDefault()
        closeSubheaderMenu()
        return
      }
      if (!canUseBoardKeyboardShortcut()) {
        return
      }
      event.preventDefault()
      closeCardMenu()
      closeListMenu()
      toggleSubheaderMenu()
      return
    }
    if (key === 's' || key === 'S') {
      if (!pageReady.value || fatalLoadError.value || getTopmostModalOverlay()) {
        return
      }
      event.preventDefault()
      toggleSidebar()
      return
    }
    if (key === 'd' || key === 'D') {
      if (!canUseBoardKeyboardShortcut()) {
        return
      }
      const openAdd = workspaceSidebarRef.value?.openDocumentAddModal
      if (!openAdd) {
        return
      }
      event.preventDefault()
      dismissBoardPopovers()
      void openAdd()
      return
    }
    if (key === 'f' || key === 'F') {
      if (!isBoardFilterTriggerAvailable()) {
        return
      }
      if (!canUseBoardKeyboardShortcut()) {
        return
      }
      event.preventDefault()
      if (boardFilterOpen.value) {
        closeBoardFilter()
        return
      }
      dismissBoardPopovers()
      openBoardFilter()
      return
    }
    if (!canUseBoardKeyboardShortcut()) {
      return
    }
    event.preventDefault()
    dismissBoardPopovers()
    const listId = resolvePointerListId()
    if (listId !== null) {
      openTaskAddModal(listId)
      return
    }
    openTaskAddFromHeader()
  }

  function onDocumentSelectStart (event: Event) {
    if (boardDragging.value || listColumnDragging.value) {
      event.preventDefault()
    }
  }

  return {
    resolvePointerTask,
    resolvePointerListId,
    syncBoardPointer,
    onBoardPointerMove,
    dismissBoardPopovers,
    canUseBoardKeyboardShortcut,
    onBoardKeydown,
    onDocumentSelectStart,
  }
}
