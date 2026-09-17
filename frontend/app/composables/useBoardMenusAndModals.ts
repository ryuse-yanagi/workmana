import type { ComputedRef, Ref } from 'vue'
import type { FloatingMenuItem } from '../components/ui/FloatingMenu.vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'
import { withAppLoadingCursor } from './useAppLoadingCursor'

type ListDefLike = {
  key: string
  title: string
  listId: number
  color: string
  color_index: number
}

type WorkspaceMetaLike = {
  id: number
  name?: string | null
} | null

type WorkspaceMutationsLike = {
  updateWorkspace: (
    id: number,
    payload: {
      name: string
      description: string | null
      status: string | null
      label_ids: number[]
      assignee_ids: number[]
    },
  ) => Promise<unknown>
  archiveWorkspace: (id: number) => Promise<unknown>
}

type FloatingMenuApi<TId extends string | number> = {
  open: (id: TId, anchor: HTMLElement) => void
  toggle: (id: TId, event: MouseEvent) => void
  openFromContextMenu: (id: TId, event: MouseEvent) => void
  close: () => void
}

/**
 * ボードのカード/リスト/サブヘッダーメニューと関連モーダル開閉。
 * フィルター popover 本体・テンプレート ref は SFC 側に残す。
 */
export function useBoardMenusAndModals<TList extends ListDefLike> (options: {
  slug: Ref<string> | ComputedRef<string>
  workspaceId: Ref<string> | ComputedRef<string>
  isOrgAdmin: Ref<boolean> | ComputedRef<boolean>
  lists: Ref<TList[]>
  error: Ref<string | null>
  listModalMode: Ref<'add' | 'edit'>
  listEditTarget: Ref<TList | null>
  listFormOpen: Ref<boolean>
  listDeleteTarget: Ref<TList | null>
  listDeleteOpen: Ref<boolean>
  archivedModalOpen: Ref<boolean>
  archivedDocumentsOpen: Ref<boolean>
  workspaceArchiveConfirmOpen: Ref<boolean>
  workspaceArchivePending: Ref<boolean>
  workspaceDetailsModalOpen: Ref<boolean>
  workspaceDetailsPending: Ref<boolean>
  workspaceDetailsModalRef: Ref<{ setSubmitError: (message: string) => void } | null>
  workspaceMeta: Ref<WorkspaceMetaLike> | ComputedRef<WorkspaceMetaLike>
  workspaceMutations: WorkspaceMutationsLike
  getOrgWorkspaceIndexCached: (slug: string) => unknown
  fetchOrgWorkspaceIndexSnapshot: (slug: string) => Promise<unknown>
  archiveConfirmTask: Ref<WorkspaceBoardTask | null>
  editingTaskId: Ref<number | null>
  subheaderMenuOpen: Ref<boolean> | ComputedRef<boolean>
  subheaderMenuTriggerRef: Ref<HTMLElement | null>
  boardFilterOpen: Ref<boolean> | ComputedRef<boolean>
  openBoardFilterBase: () => void
  closeBoardFilter: () => void
  cardMenu: FloatingMenuApi<number>
  listMenu: FloatingMenuApi<string>
  subheaderMenu: { open: (id: 'subheader', anchor: HTMLElement) => void, close: () => void }
  openMenuTask: ComputedRef<WorkspaceBoardTask | null>
  openListMenuList: ComputedRef<TList | null>
  openTaskDetail: (task: WorkspaceBoardTask) => void
}) {
  const {
    slug,
    workspaceId,
    isOrgAdmin,
    lists,
    error,
    listModalMode,
    listEditTarget,
    listFormOpen,
    listDeleteTarget,
    listDeleteOpen,
    archivedModalOpen,
    archivedDocumentsOpen,
    workspaceArchiveConfirmOpen,
    workspaceArchivePending,
    workspaceDetailsModalOpen,
    workspaceDetailsPending,
    workspaceDetailsModalRef,
    workspaceMeta,
    workspaceMutations,
    getOrgWorkspaceIndexCached,
    fetchOrgWorkspaceIndexSnapshot,
    archiveConfirmTask,
    editingTaskId,
    subheaderMenuOpen,
    subheaderMenuTriggerRef,
    boardFilterOpen,
    openBoardFilterBase,
    closeBoardFilter,
    cardMenu,
    listMenu,
    subheaderMenu,
    openMenuTask,
    openListMenuList,
    openTaskDetail,
  } = options

  function closeSubheaderMenu () {
    subheaderMenu.close()
  }

  function openListAddModal () {
    closeSubheaderMenu()
    closeBoardFilter()
    listMenu.close()
    listModalMode.value = 'add'
    listEditTarget.value = null
    listFormOpen.value = true
  }

  function openListEditModal (list: TList) {
    listMenu.close()
    listModalMode.value = 'edit'
    listEditTarget.value = list
    listFormOpen.value = true
  }

  function openListDeleteModal (list: TList) {
    listMenu.close()
    listDeleteTarget.value = list
    listDeleteOpen.value = true
  }

  const subheaderMenuItems = computed<FloatingMenuItem[]>(() => {
    const items: FloatingMenuItem[] = [
      { key: 'details-workspace', label: 'スペース詳細' },
      { key: 'add-list', label: 'リストの追加' },
      { key: 'archived', label: 'アーカイブ済みタスク' },
      { key: 'archived-documents', label: 'アーカイブ済み資料' },
    ]
    if (isOrgAdmin.value) {
      items.push({ key: 'archive-workspace', label: 'スペースのアーカイブ', danger: true })
    }
    return items
  })

  const cardMenuItems = computed<FloatingMenuItem[]>(() => {
    const items: FloatingMenuItem[] = [
      { key: 'detail', label: 'タスク詳細' },
    ]
    if (isOrgAdmin.value) {
      items.push({ key: 'archive', label: 'タスクのアーカイブ', danger: true })
    }
    return items
  })

  const listMenuItems = computed<FloatingMenuItem[]>(() => {
    const items: FloatingMenuItem[] = [
      { key: 'edit', label: 'リストの編集' },
    ]
    if (lists.value.length > 1) {
      items.push({ key: 'delete', label: 'リストの削除', danger: true })
    }
    return items
  })

  function openArchivedModal () {
    closeSubheaderMenu()
    closeBoardFilter()
    archivedModalOpen.value = true
  }

  function openArchivedDocumentsModal () {
    closeSubheaderMenu()
    closeBoardFilter()
    archivedDocumentsOpen.value = true
  }

  function openWorkspaceArchiveConfirm () {
    closeSubheaderMenu()
    workspaceArchiveConfirmOpen.value = true
  }

  async function openWorkspaceDetailsModal () {
    closeSubheaderMenu()
    if (!getOrgWorkspaceIndexCached(slug.value)) {
      await fetchOrgWorkspaceIndexSnapshot(slug.value).catch(() => null)
    }
    workspaceDetailsModalOpen.value = true
  }

  function onSubheaderMenuSelect (item: FloatingMenuItem) {
    if (item.key === 'details-workspace') {
      void openWorkspaceDetailsModal()
      return
    }
    if (item.key === 'add-list') {
      openListAddModal()
      return
    }
    if (item.key === 'archived') {
      openArchivedModal()
      return
    }
    if (item.key === 'archived-documents') {
      openArchivedDocumentsModal()
      return
    }
    if (item.key === 'archive-workspace') {
      openWorkspaceArchiveConfirm()
    }
  }

  async function onWorkspaceDetailsSubmit (payload: {
    name: string
    description: string | null
    status: string | null
    label_ids: number[]
    assignee_ids: number[]
  }) {
    const target = workspaceMeta.value
    if (!target || workspaceDetailsPending.value) {
      return
    }
    workspaceDetailsPending.value = true
    error.value = null
    try {
      await withAppLoadingCursor(async () => {
        await workspaceMutations.updateWorkspace(target.id, {
          name: payload.name,
          description: payload.description,
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        })
        workspaceDetailsModalOpen.value = false
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '更新に失敗しました'
      error.value = message
      workspaceDetailsModalRef.value?.setSubmitError(message)
    } finally {
      workspaceDetailsPending.value = false
    }
  }

  async function confirmWorkspaceArchive () {
    if (workspaceArchivePending.value) {
      return
    }
    workspaceArchivePending.value = true
    error.value = null
    try {
      await withAppLoadingCursor(async () => {
        await workspaceMutations.archiveWorkspace(Number(workspaceId.value))
        workspaceArchiveConfirmOpen.value = false
        await navigateTo(`/org/${slug.value}/workspaces`)
      })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
    } finally {
      workspaceArchivePending.value = false
    }
  }

  function openArchiveConfirm (task: WorkspaceBoardTask) {
    cardMenu.close()
    editingTaskId.value = null
    archiveConfirmTask.value = task
  }

  function onCardMenuSelect (item: FloatingMenuItem) {
    const task = openMenuTask.value
    if (!task) return
    if (item.key === 'detail') {
      openTaskDetail(task)
      return
    }
    if (item.key === 'archive') {
      openArchiveConfirm(task)
    }
  }

  function onListMenuSelect (item: FloatingMenuItem) {
    const list = openListMenuList.value
    if (!list) return
    if (item.key === 'edit') {
      openListEditModal(list)
      return
    }
    if (item.key === 'delete') {
      openListDeleteModal(list)
    }
  }

  function toggleListMenu (listKey: string, event: MouseEvent) {
    event.stopPropagation()
    listMenu.toggle(listKey, event)
  }

  function toggleSubheaderMenu () {
    if (subheaderMenuOpen.value) {
      closeSubheaderMenu()
      return
    }
    closeBoardFilter()
    const anchor = subheaderMenuTriggerRef.value
    if (!anchor) {
      return
    }
    subheaderMenu.open('subheader', anchor)
  }

  function openBoardFilter () {
    openBoardFilterBase()
  }

  function toggleBoardFilter () {
    if (boardFilterOpen.value) {
      closeBoardFilter()
      return
    }
    openBoardFilter()
  }

  function onDropZoneScroll () {
    cardMenu.close()
    listMenu.close()
  }

  function openCardMenu (taskId: number, anchor: HTMLElement) {
    cardMenu.open(taskId, anchor)
  }

  function toggleCardMenu (taskId: number, ev: MouseEvent) {
    ev.stopPropagation()
    cardMenu.toggle(taskId, ev)
  }

  function onTaskCardContextMenu (task: WorkspaceBoardTask, ev: MouseEvent) {
    if (editingTaskId.value === task.id) return
    cardMenu.openFromContextMenu(task.id, ev)
  }

  return {
    openListAddModal,
    openListEditModal,
    openListDeleteModal,
    subheaderMenuItems,
    cardMenuItems,
    listMenuItems,
    onSubheaderMenuSelect,
    openArchivedModal,
    openArchivedDocumentsModal,
    openWorkspaceArchiveConfirm,
    openWorkspaceDetailsModal,
    onWorkspaceDetailsSubmit,
    confirmWorkspaceArchive,
    openArchiveConfirm,
    onCardMenuSelect,
    onListMenuSelect,
    toggleListMenu,
    closeSubheaderMenu,
    toggleSubheaderMenu,
    openBoardFilter,
    toggleBoardFilter,
    onDropZoneScroll,
    openCardMenu,
    toggleCardMenu,
    onTaskCardContextMenu,
  }
}
