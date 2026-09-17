import type { MaybeRefOrGetter, Ref } from 'vue'
import type { FloatingMenuItem } from '../components/ui/FloatingMenu.vue'
import { buildDestructiveConfirmMessage } from '../utils/destructiveConfirmMessage'
import { POPOVER_VIEWPORT_INSET, clampPopoverBox, resolveMeasuredFloatingMenuHeight } from '../utils/popoverScrollbar'
import { getTopmostModalOverlay, isKeyboardShortcutBlockedTarget } from '../utils/uiInteraction'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import { useApi } from './useApi'
import { useDropdownEscapeClose } from './useDropdownEscapeClose'
import { useUiSidebarPreference } from './useUiSidebarPreference'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
} from './useOrgDocumentsPageData'
import { useArchivedNamedItemsCache } from './useArchivedNamedItemsCache'
import {
  removeDocumentFromWorkspaceDetailCache,
  updateDocumentInWorkspaceDetailCache,
} from './useWorkspaceDetailMeta'
import { useOrgRole } from './useOrgRole'
import { workspaceDocumentPath } from './useWorkspaceViewRoutes'
import { useStickyHeaderOffsets } from './useWorkspaceViewPageRoot'
import { isViewShortcutModifierBlocked } from './useViewKeyboardShortcuts'
import type { TaskFormCategory } from './useTaskFormHelpers'

/**
 * 資料詳細ページのヘッダーメニュー・モーダル・ショートカット・サイドバー。
 */
export function useDocumentPageChrome (options: {
  orgSlug: MaybeRefOrGetter<string>
  currentDocument: Ref<OrgDocument | null>
  pageReady: Ref<boolean>
  fatalLoadError: Ref<string | null>
  bodyEditing: Ref<boolean>
  bodySaving: Ref<boolean>
  leaveModalOpen: Ref<boolean>
  documentAddModalOpen: Ref<boolean>
  documentCardDetailsModalOpen: Ref<boolean>
  documentCardArchiveConfirmOpen: Ref<boolean>
  resolveDocumentCategoryOption: (
    category: OrgDocument['category'],
  ) => TaskFormCategory | null
  applyDocument: (value: OrgDocument) => boolean
  startBodyEdit: () => void | Promise<void>
  openDocumentAddModal: () => void | Promise<void>
  closeDocumentCardMenu: () => void
  discardBodyEditOnLeave: () => void
  adjustBodyHeight: () => void
}) {
  const router = useRouter()
  const slug = computed(() => String(toValue(options.orgSlug) ?? '').trim())
  const { api } = useApi()
  const { isOrgAdmin } = useOrgRole(slug)
  const { upsertDocumentCached, removeDocumentCached } = useOrgDocumentsPageData()
  const { upsertCachedItem: upsertArchivedNamedItem } = useArchivedNamedItemsCache()

  const {
    globalHeaderOffsetPx,
    updateStickyOffsets: updateHeaderOffset,
    bindStickyOffsets,
    unbindStickyOffsets,
  } = useStickyHeaderOffsets({
    autoBind: false,
    onUpdate: () => {
      if (options.bodyEditing.value) {
        options.adjustBodyHeight()
      }
    },
  })

  function updateStickyOffsets () {
    updateHeaderOffset()
  }

  const documentMenuOpen = ref(false)
  const { sidebarOpen, toggleSidebar, hydrateSidebarPreference } = useUiSidebarPreference('document')
  const documentMenuMode = ref<'actions' | 'share'>('actions')
  const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
  const documentMenuTriggerRef = ref<HTMLButtonElement | null>(null)
  const shareUrlInputRef = ref<HTMLInputElement | null>(null)
  const documentDetailsModalOpen = ref(false)
  const documentArchiveConfirmOpen = ref(false)
  const documentMetaPending = ref(false)
  const archivePending = ref(false)
  const documentDetailsModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
  const DOCUMENT_MENU_ACTIONS_WIDTH = 160
  const DOCUMENT_MENU_SHARE_WIDTH = 320

  const pageCssVars = computed(() => ({
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
  } as Record<string, string>))

  const documentShareUrl = computed(() => {
    if (!import.meta.client || !options.currentDocument.value) {
      return ''
    }
    return `${window.location.origin}${workspaceDocumentPath(
      slug.value,
      options.currentDocument.value.workspace_id,
      options.currentDocument.value.id,
    )}`
  })

  const documentMenuStyle = computed(() => {
    if (!documentMenuPosition.value) {
      return undefined
    }
    const { top, left } = documentMenuPosition.value
    const width = documentMenuMode.value === 'share'
      ? DOCUMENT_MENU_SHARE_WIDTH
      : DOCUMENT_MENU_ACTIONS_WIDTH
    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      zIndex: 80,
    }
  })

  const documentDetailsInitialValues = computed(() => {
    const target = options.currentDocument.value
    if (!target) {
      return null
    }
    return {
      name: target.name,
      description: target.description ?? null,
      category: options.resolveDocumentCategoryOption(target.category),
    }
  })

  function closeDocumentMenu () {
    documentMenuOpen.value = false
    documentMenuMode.value = 'actions'
    documentMenuPosition.value = null
  }

  function positionDocumentMenu (anchor: HTMLElement) {
    if (!import.meta.client) {
      documentMenuPosition.value = null
      return
    }
    const rect = anchor.getBoundingClientRect()
    const pad = POPOVER_VIEWPORT_INSET
    const gap = 4
    const menuWidth = documentMenuMode.value === 'share'
      ? DOCUMENT_MENU_SHARE_WIDTH
      : DOCUMENT_MENU_ACTIONS_WIDTH
    const menuHeight = resolveMeasuredFloatingMenuHeight(
      documentMenuMode.value === 'share' ? 2 : documentHeaderMenuItems.value.length,
    )
    let left = rect.right - menuWidth
    left = Math.min(left, window.innerWidth - pad - menuWidth)
    left = Math.max(pad, left)
    documentMenuPosition.value = clampPopoverBox(rect.bottom + gap, left, menuWidth, menuHeight, pad)
  }

  function toggleDocumentMenu () {
    if (documentMenuOpen.value) {
      closeDocumentMenu()
      return
    }
    const anchor = documentMenuTriggerRef.value
    if (!anchor) {
      return
    }
    documentMenuMode.value = 'actions'
    positionDocumentMenu(anchor)
    documentMenuOpen.value = true
    nextTick(() => {
      if (documentMenuOpen.value && documentMenuTriggerRef.value) {
        positionDocumentMenu(documentMenuTriggerRef.value)
      }
    })
  }

  function dismissDocumentPopovers () {
    closeDocumentMenu()
    options.closeDocumentCardMenu()
  }

  function canUseDocumentKeyboardShortcut (shortcutOptions?: {
    allowBodyEditing?: boolean
  }): boolean {
    if (!options.pageReady.value || options.fatalLoadError.value || !options.currentDocument.value) {
      return false
    }
    if (getTopmostModalOverlay()) {
      return false
    }
    if (
      options.documentAddModalOpen.value
      || documentDetailsModalOpen.value
      || documentArchiveConfirmOpen.value
      || options.documentCardDetailsModalOpen.value
      || options.documentCardArchiveConfirmOpen.value
      || options.leaveModalOpen.value
      || options.bodySaving.value
      || (!shortcutOptions?.allowBodyEditing && options.bodyEditing.value)
    ) {
      return false
    }
    return true
  }

  function onDocumentPageKeydown (event: KeyboardEvent) {
    const key = event.key
    const isLetterShortcut = (
      key === 'm' || key === 'M'
      || key === 's' || key === 'S'
      || key === 'e' || key === 'E'
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
      if (documentMenuOpen.value) {
        event.preventDefault()
        closeDocumentMenu()
        return
      }
      if (!canUseDocumentKeyboardShortcut({ allowBodyEditing: true })) {
        return
      }
      event.preventDefault()
      options.closeDocumentCardMenu()
      toggleDocumentMenu()
      return
    }
    if (key === 's' || key === 'S') {
      if (!options.pageReady.value || options.fatalLoadError.value || getTopmostModalOverlay()) {
        return
      }
      event.preventDefault()
      toggleSidebar()
      return
    }
    if (key === 'e' || key === 'E') {
      if (options.bodyEditing.value) {
        return
      }
      if (!canUseDocumentKeyboardShortcut()) {
        return
      }
      event.preventDefault()
      dismissDocumentPopovers()
      void options.startBodyEdit()
      return
    }
    if (!canUseDocumentKeyboardShortcut({ allowBodyEditing: true })) {
      return
    }
    event.preventDefault()
    dismissDocumentPopovers()
    void options.openDocumentAddModal()
  }

  async function switchDocumentMenuToShare () {
    documentMenuMode.value = 'share'
    const anchor = documentMenuTriggerRef.value
    if (anchor) {
      positionDocumentMenu(anchor)
    }
    await nextTick()
    if (anchor) {
      positionDocumentMenu(anchor)
    }
    const input = shareUrlInputRef.value
    if (input) {
      input.focus()
      input.select()
    }
  }

  function onShareUrlClick (event: MouseEvent) {
    const el = event.currentTarget
    if (el instanceof HTMLInputElement) {
      el.select()
    }
  }

  function onShareUrlFocus (event: FocusEvent) {
    const el = event.currentTarget
    if (el instanceof HTMLInputElement) {
      el.select()
    }
  }

  const documentHeaderMenuItems = computed<FloatingMenuItem[]>(() => {
    const items: FloatingMenuItem[] = [
      {
        key: 'details',
        label: '資料詳細',
        disabled: documentMetaPending.value,
      },
      { key: 'share', label: '資料の共有' },
    ]
    if (isOrgAdmin.value) {
      items.push({
        key: 'archive',
        label: '資料のアーカイブ',
        danger: true,
        disabled: documentMetaPending.value || archivePending.value,
      })
    }
    return items
  })

  function onDocumentHeaderMenuSelect (item: FloatingMenuItem) {
    if (item.key === 'details') {
      openDocumentDetailsModal()
      return
    }
    if (item.key === 'share') {
      void switchDocumentMenuToShare()
      return
    }
    if (item.key === 'archive') {
      openDocumentArchiveConfirm()
    }
  }

  function openDocumentDetailsModal () {
    closeDocumentMenu()
    documentDetailsModalOpen.value = true
  }

  function openDocumentArchiveConfirm () {
    closeDocumentMenu()
    documentArchiveConfirmOpen.value = true
  }

  async function onDocumentDetailsSubmit (payload: {
    name: string
    description: string | null
    category: string | null
  }) {
    const target = options.currentDocument.value
    if (!target || documentMetaPending.value) {
      return
    }
    documentMetaPending.value = true
    try {
      await withAppLoadingCursor(async () => {
        const updated = await api<OrgDocument>(
          `/orgs/${slug.value}/documents/${target.id}`,
          {
            method: 'PATCH',
            body: {
              name: payload.name,
              description: payload.description,
              category: payload.category,
            },
          },
        )
        options.applyDocument(updated)
        upsertDocumentCached(slug.value, updated)
        updateDocumentInWorkspaceDetailCache(slug.value, updated.workspace_id, {
          id: updated.id,
          name: updated.name,
          description: updated.description ?? null,
          category: updated.category ?? null,
        })
        documentDetailsModalOpen.value = false
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '資料の更新に失敗しました'
      documentDetailsModalRef.value?.setSubmitError(message)
    } finally {
      documentMetaPending.value = false
    }
  }

  async function confirmDocumentArchive () {
    const target = options.currentDocument.value
    if (!target || archivePending.value) {
      return
    }
    archivePending.value = true
    try {
      await withAppLoadingCursor(async () => {
        await api(`/orgs/${slug.value}/documents/${target.id}/archive`, {
          method: 'POST',
        })
        documentArchiveConfirmOpen.value = false
        removeDocumentCached(slug.value, target.id)
        removeDocumentFromWorkspaceDetailCache(slug.value, target.workspace_id, target.id)
        upsertArchivedNamedItem(
          {
            orgSlug: slug.value,
            resource: 'documents',
            workspaceId: target.workspace_id,
          },
          {
            id: target.id,
            name: target.name,
            description: target.description ?? null,
            archived_at: new Date().toISOString(),
          },
        )
        await router.push(`/org/${slug.value}/workspaces/${target.workspace_id}`)
      })
    } catch {
      // アーカイブ失敗時は ConfirmModal を開いたままにする
    } finally {
      archivePending.value = false
    }
  }

  function onDocumentMenuWindowResize () {
    if (!documentMenuOpen.value) {
      return
    }
    closeDocumentMenu()
  }

  useDropdownEscapeClose(documentMenuOpen, closeDocumentMenu)

  function bindDocumentPageChromeListeners () {
    if (!import.meta.client) {
      return
    }
    document.addEventListener('keydown', onDocumentPageKeydown)
  }

  function unbindDocumentPageChromeListeners () {
    if (!import.meta.client) {
      return
    }
    document.removeEventListener('keydown', onDocumentPageKeydown)
  }

  onBeforeMount(() => {
    void hydrateSidebarPreference()
  })

  onActivated(() => {
    void hydrateSidebarPreference()
    options.discardBodyEditOnLeave()
    bindDocumentPageChromeListeners()
    if (import.meta.client) {
      nextTick(() => {
        updateStickyOffsets()
      })
    }
  })

  onDeactivated(() => {
    options.discardBodyEditOnLeave()
    closeDocumentMenu()
    documentDetailsModalOpen.value = false
    documentArchiveConfirmOpen.value = false
    unbindDocumentPageChromeListeners()
  })

  onMounted(() => {
    if (!import.meta.client) {
      return
    }
    bindDocumentPageChromeListeners()
    nextTick(() => {
      bindStickyOffsets()
      window.addEventListener('resize', onDocumentMenuWindowResize)
    })
  })

  onBeforeUnmount(() => {
    if (!import.meta.client) {
      return
    }
    unbindDocumentPageChromeListeners()
    window.removeEventListener('resize', onDocumentMenuWindowResize)
    unbindStickyOffsets()
  })

  return {
    pageCssVars,
    updateStickyOffsets,
    sidebarOpen,
    toggleSidebar,
    documentMenuOpen,
    documentMenuMode,
    documentMenuPosition,
    documentMenuTriggerRef,
    shareUrlInputRef,
    documentDetailsModalOpen,
    documentArchiveConfirmOpen,
    documentMetaPending,
    archivePending,
    documentDetailsModalRef,
    documentShareUrl,
    documentMenuStyle,
    documentDetailsInitialValues,
    documentHeaderMenuItems,
    closeDocumentMenu,
    toggleDocumentMenu,
    onShareUrlClick,
    onShareUrlFocus,
    onDocumentHeaderMenuSelect,
    onDocumentDetailsSubmit,
    confirmDocumentArchive,
    buildDestructiveConfirmMessage,
  }
}
