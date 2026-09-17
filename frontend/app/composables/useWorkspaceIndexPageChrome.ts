import type { Ref } from 'vue'
import type { FloatingMenuItem } from '../components/ui/FloatingMenu.vue'
import BoardFilterPopover from '../components/ui/BoardFilterPopover.vue'
import { getTopmostModalOverlay, isKeyboardShortcutBlockedTarget } from '../utils/uiInteraction'
import { useAnchoredFilterPopover } from './useAnchoredFilterPopover'
import { useFloatingMenuState } from './useFloatingMenuState'
import { isViewShortcutModifierBlocked } from './useViewKeyboardShortcuts'
import type { ListFilterSectionKey } from './useWorkspaceListFilters'
import type { WorkspaceIndexRow } from './useWorkspaceIndexPageLoad'

/**
 * スペース一覧の行メニュー・サブヘッダー・フィルタ・モーダル開閉・ショートカット。
 */
export function useWorkspaceIndexPageChrome (options: {
  pageReady: Ref<boolean>
  fatalLoadError: Ref<string | null>
  pending: Ref<boolean>
  archivePending: Ref<boolean>
  isOrgAdmin: Ref<boolean>
  workspaces: Ref<WorkspaceIndexRow[]>
  clearListFilterSearchQueries: () => void
  pinWorkspace: (workspaceId: number) => Promise<void>
  unpinWorkspace: (workspaceId: number) => Promise<void>
  createWorkspace: (
    payload: {
      name: string
      description: string | null
      status: string | null
      label_ids: number[]
      assignee_ids: number[]
    },
    formControls: {
      closeModal: () => void
      setSubmitError: (message: string) => void
    },
  ) => Promise<void>
  updateWorkspace: (
    target: WorkspaceIndexRow,
    payload: {
      name: string
      description: string | null
      status: string | null
      label_ids: number[]
      assignee_ids: number[]
    },
    formControls: {
      closeModal: () => void
      setSubmitError: (message: string) => void
    },
  ) => Promise<void>
  confirmWorkspaceArchive: (
    target: WorkspaceIndexRow,
    controls: { closeConfirm: () => void },
  ) => Promise<void>
}) {
  const workspaceFormModalOpen = ref(false)
  const workspaceFormModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
  const workspaceFormMode = ref<'create' | 'details'>('create')
  const workspaceDetailsTarget = ref<WorkspaceIndexRow | null>(null)
  const workspaceArchiveConfirmOpen = ref(false)
  const workspaceArchiveTarget = ref<WorkspaceIndexRow | null>(null)
  const archivedWorkspacesOpen = ref(false)

  const WORKSPACE_MENU_MIN_WIDTH = 160
  const workspaceMenu = useFloatingMenuState<number>({
    menuMinWidth: WORKSPACE_MENU_MIN_WIDTH,
    getMenuItemCount: () => workspaceMenuItems.value.length,
    gap: 4,
  })
  const openMenuWorkspaceId = workspaceMenu.openId
  const workspaceMenuPosition = workspaceMenu.position
  const pendingWorkspaceMenuOpen = workspaceMenu.pendingOpen
  let workspaceMenuAnchorEl: HTMLElement | null = null

  const subheaderMenuTriggerRef = ref<HTMLElement | null>(null)
  const SUBHEADER_MENU_MIN_WIDTH = 220
  const subheaderMenu = useFloatingMenuState<'subheader'>({
    menuMinWidth: SUBHEADER_MENU_MIN_WIDTH,
    getMenuItemCount: () => subheaderMenuItems.length,
    placement: 'below-end',
  })
  const subheaderMenuOpen = computed({
    get: () => subheaderMenu.openId.value !== null,
    set: (open: boolean) => {
      if (!open) subheaderMenu.close()
    },
  })
  const subheaderMenuPosition = subheaderMenu.position

  const listFilterTriggerRef = ref<HTMLElement | null>(null)
  function setListFilterTriggerRef (comp: { el?: HTMLElement | null } | null) {
    listFilterTriggerRef.value = comp?.el ?? null
  }
  const listFilterDropdownRef = ref<InstanceType<typeof BoardFilterPopover> | null>(null)

  const filterSectionsOpen = reactive<Record<ListFilterSectionKey, boolean>>({
    assignee: true,
    label: true,
    status: true,
  })

  const {
    open: listFilterOpen,
    style: listFilterStyle,
    close: closeListFilter,
    openPopover: openListFilter,
    onAfterLeave: onListFilterAfterLeave,
    onSectionToggle: onFilterSectionToggle,
  } = useAnchoredFilterPopover({
    triggerRef: listFilterTriggerRef,
    dropdownRef: listFilterDropdownRef,
    onClose: options.clearListFilterSearchQueries,
    onBeforeOpen: () => {
      workspaceMenu.close()
      subheaderMenu.close()
    },
    // repositionSources filled after listFilters are available via page wiring —
    // caller should pass search query refs by mutating this array if needed.
    repositionSources: [],
  })

  function setListFilterRepositionSources (sources: Ref<unknown>[]) {
    // useAnchoredFilterPopover captures sources at init; reopen uses current trigger.
    void sources
  }

  const openMenuWorkspace = computed(() => {
    const id = openMenuWorkspaceId.value
    if (id == null) return null
    return options.workspaces.value.find(workspace => workspace.id === id) ?? null
  })
  const workspaceMenuStyle = workspaceMenu.style
  const subheaderMenuStyle = subheaderMenu.style

  const workspaceFormInitialValues = computed(() => {
    if (workspaceFormMode.value !== 'details' || !workspaceDetailsTarget.value) {
      return null
    }
    const target = workspaceDetailsTarget.value
    const status = target.status
      ? {
          name: target.status.name,
          color: target.status.color ?? '',
        }
      : null
    return {
      name: target.name,
      description: target.description ?? null,
      labels: target.labels ?? [],
      assignees: target.assignees ?? [],
      status,
    }
  })

  const closeWorkspaceMenu = workspaceMenu.close

  function onWorkspaceMenuAfterLeave () {
    const pending = pendingWorkspaceMenuOpen.value
    if (!pending) {
      workspaceMenuAnchorEl = null
    } else {
      workspaceMenuAnchorEl = pending.anchor
    }
    workspaceMenu.onAfterLeave()
  }

  function closeSubheaderMenu () {
    subheaderMenu.close()
  }

  function toggleSubheaderMenu () {
    if (subheaderMenuOpen.value) {
      closeSubheaderMenu()
      return
    }
    closeWorkspaceMenu()
    closeListFilter()
    const anchor = subheaderMenuTriggerRef.value
    if (!anchor) {
      return
    }
    subheaderMenu.open('subheader', anchor)
  }

  function toggleListFilter () {
    if (listFilterOpen.value) {
      closeListFilter()
      return
    }
    openListFilter()
  }

  function openArchivedWorkspacesModal () {
    closeSubheaderMenu()
    closeListFilter()
    archivedWorkspacesOpen.value = true
  }

  function openWorkspaceMenu (workspaceId: number, anchor: HTMLElement) {
    closeSubheaderMenu()
    closeListFilter()
    workspaceMenuAnchorEl = anchor
    workspaceMenu.open(workspaceId, anchor)
  }

  function toggleWorkspaceMenu (workspaceId: number, event: MouseEvent) {
    const el = event.currentTarget
    if (!(el instanceof HTMLElement)) {
      return
    }
    openWorkspaceMenu(workspaceId, el)
  }

  function onWorkspaceContextMenu (workspaceId: number, event: MouseEvent) {
    workspaceMenu.openFromContextMenu(workspaceId, event, '.workspace-card__menu-btn')
  }

  function openWorkspaceCreateModal () {
    closeWorkspaceMenu()
    closeSubheaderMenu()
    closeListFilter()
    workspaceFormMode.value = 'create'
    workspaceDetailsTarget.value = null
    workspaceFormModalOpen.value = true
  }

  function canUseWorkspaceListKeyboardShortcut (): boolean {
    if (!options.pageReady.value || options.fatalLoadError.value) {
      return false
    }
    if (getTopmostModalOverlay()) {
      return false
    }
    if (
      workspaceFormModalOpen.value
      || workspaceArchiveConfirmOpen.value
      || archivedWorkspacesOpen.value
      || options.pending.value
      || options.archivePending.value
    ) {
      return false
    }
    return true
  }

  function onWorkspaceListKeydown (event: KeyboardEvent) {
    const key = event.key
    if (
      key !== 'n' && key !== 'N'
      && key !== 'f' && key !== 'F'
      && key !== 'm' && key !== 'M'
    ) {
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
      if (!canUseWorkspaceListKeyboardShortcut()) {
        return
      }
      event.preventDefault()
      toggleSubheaderMenu()
      return
    }
    if (!canUseWorkspaceListKeyboardShortcut()) {
      return
    }
    if (key === 'f' || key === 'F') {
      const anchor = listFilterTriggerRef.value
      if (!anchor || !anchor.isConnected) {
        return
      }
      event.preventDefault()
      toggleListFilter()
      return
    }
    event.preventDefault()
    openWorkspaceCreateModal()
  }

  function openWorkspaceDetailsModal (workspace: WorkspaceIndexRow) {
    closeWorkspaceMenu()
    workspaceFormMode.value = 'details'
    workspaceDetailsTarget.value = workspace
    workspaceFormModalOpen.value = true
  }

  function openWorkspaceArchiveConfirm (workspace: WorkspaceIndexRow) {
    closeWorkspaceMenu()
    workspaceArchiveTarget.value = workspace
    workspaceArchiveConfirmOpen.value = true
  }

  const workspaceMenuItems = computed<FloatingMenuItem[]>(() => {
    const pinned = Boolean(openMenuWorkspace.value?.pinned)
    const items: FloatingMenuItem[] = [
      { key: 'details', label: 'スペース詳細' },
      {
        key: pinned ? 'unpin' : 'pin',
        label: pinned ? 'ピン留めの解除' : 'ピン留めの登録',
      },
    ]
    if (options.isOrgAdmin.value) {
      items.push({ key: 'archive', label: 'スペースのアーカイブ', danger: true })
    }
    return items
  })

  const subheaderMenuItems: FloatingMenuItem[] = [
    { key: 'archived', label: 'アーカイブ済みスペース' },
  ]

  function onSubheaderMenuSelect (item: FloatingMenuItem) {
    if (item.key === 'archived') {
      openArchivedWorkspacesModal()
    }
  }

  async function onWorkspaceMenuSelect (item: FloatingMenuItem) {
    const workspace = openMenuWorkspace.value
    if (!workspace) return
    if (item.key === 'pin') {
      closeWorkspaceMenu()
      await options.pinWorkspace(workspace.id)
      return
    }
    if (item.key === 'unpin') {
      closeWorkspaceMenu()
      await options.unpinWorkspace(workspace.id)
      return
    }
    if (item.key === 'details') {
      openWorkspaceDetailsModal(workspace)
      return
    }
    if (item.key === 'archive') {
      openWorkspaceArchiveConfirm(workspace)
    }
  }

  function onWindowResize () {
    closeWorkspaceMenu()
    closeSubheaderMenu()
    closeListFilter()
  }

  async function onWorkspaceFormSubmit (payload: {
    name: string
    description: string | null
    status: string | null
    label_ids: number[]
    assignee_ids: number[]
  }) {
    const formControls = {
      closeModal: () => {
        workspaceFormModalOpen.value = false
        workspaceDetailsTarget.value = null
      },
      setSubmitError: (message: string) => {
        workspaceFormModalRef.value?.setSubmitError(message)
      },
    }
    if (workspaceFormMode.value === 'details') {
      const target = workspaceDetailsTarget.value
      if (!target) return
      await options.updateWorkspace(target, payload, formControls)
      return
    }
    await options.createWorkspace(payload, {
      closeModal: () => {
        workspaceFormModalOpen.value = false
      },
      setSubmitError: formControls.setSubmitError,
    })
  }

  async function onConfirmWorkspaceArchive () {
    const target = workspaceArchiveTarget.value
    if (!target) return
    await options.confirmWorkspaceArchive(target, {
      closeConfirm: () => {
        workspaceArchiveConfirmOpen.value = false
        workspaceArchiveTarget.value = null
      },
    })
  }

  function bindWorkspaceListChromeListeners () {
    if (!import.meta.client) {
      return
    }
    document.addEventListener('keydown', onWorkspaceListKeydown)
  }

  function unbindWorkspaceListChromeListeners () {
    if (!import.meta.client) {
      return
    }
    document.removeEventListener('keydown', onWorkspaceListKeydown)
  }

  onActivated(() => {
    bindWorkspaceListChromeListeners()
  })

  onDeactivated(() => {
    closeWorkspaceMenu()
    closeSubheaderMenu()
    closeListFilter()
    unbindWorkspaceListChromeListeners()
  })

  onMounted(() => {
    if (!import.meta.client) {
      return
    }
    bindWorkspaceListChromeListeners()
    window.addEventListener('resize', onWindowResize)
  })

  onBeforeUnmount(() => {
    if (!import.meta.client) {
      return
    }
    unbindWorkspaceListChromeListeners()
    window.removeEventListener('resize', onWindowResize)
    closeWorkspaceMenu()
    closeSubheaderMenu()
    closeListFilter()
  })

  return {
    workspaceFormModalOpen,
    workspaceFormModalRef,
    workspaceFormMode,
    workspaceDetailsTarget,
    workspaceArchiveConfirmOpen,
    workspaceArchiveTarget,
    archivedWorkspacesOpen,
    openMenuWorkspaceId,
    workspaceMenuPosition,
    subheaderMenuTriggerRef,
    subheaderMenuOpen,
    subheaderMenuPosition,
    setListFilterTriggerRef,
    listFilterDropdownRef,
    filterSectionsOpen,
    listFilterOpen,
    listFilterStyle,
    closeListFilter,
    onListFilterAfterLeave,
    onFilterSectionToggle,
    openMenuWorkspace,
    workspaceMenuStyle,
    subheaderMenuStyle,
    workspaceFormInitialValues,
    closeWorkspaceMenu,
    onWorkspaceMenuAfterLeave,
    closeSubheaderMenu,
    toggleSubheaderMenu,
    toggleListFilter,
    toggleWorkspaceMenu,
    onWorkspaceContextMenu,
    openWorkspaceCreateModal,
    workspaceMenuItems,
    subheaderMenuItems,
    onSubheaderMenuSelect,
    onWorkspaceMenuSelect,
    onWorkspaceFormSubmit,
    onConfirmWorkspaceArchive,
    setListFilterRepositionSources,
  }
}
