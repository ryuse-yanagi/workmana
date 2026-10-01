import { type FloatingMenuItem } from '../../components/ui/FloatingMenu.vue'
import type { DocumentFormInitialValues } from '../../components/modals/document/DocumentFormModal.vue'
import { buildDestructiveConfirmMessage } from '../../utils/shared/destructiveConfirmMessage'
import { resolveStandardColors } from '../../utils/shared/colorPresetResolution'
import { withAppLoadingCursor } from '../ui/useAppLoadingCursor'
import { useApi } from '../shared/useApi'
import { useOrgRole } from '../org/useOrgRole'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
  type OrgDocumentCategory,
} from './useOrgDocumentsPageData'
import type { OrgWorkspaceDocumentItem } from '../workspace/useOrgWorkspaceIndexPageData'
import type { TaskFormCategory } from '../task/useTaskFormHelpers'
import {
  applyDocumentArchived,
  applyDocumentUpdated,
} from './syncDocumentCaches'
import { useFloatingMenuState } from '../ui/useFloatingMenuState'

const DOCUMENT_CARD_MENU_WIDTH = 168

export function useWorkspaceDocumentCardMenu (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
  options?: {
    documents?: MaybeRefOrGetter<OrgWorkspaceDocumentItem[]>
    onDocumentUpdated?: (document: OrgDocument) => void
    onDocumentArchived?: (document: {
      id: number
      name: string
      workspaceId: number
    }) => void | Promise<void>
  },
) {
  const { api } = useApi()
  const orgSlugRef = computed(() => String(toValue(orgSlug) ?? '').trim())
  const { isOrgAdmin } = useOrgRole(orgSlugRef)
  const {
    getCached,
    fetchSnapshot,
    fetchDocument,
  } = useOrgDocumentsPageData()

  const documentDetailsModalOpen = ref(false)
  const documentArchiveConfirmOpen = ref(false)
  const documentMetaPending = ref(false)
  const archivePending = ref(false)
  const editingDocumentId = ref<number | null>(null)
  const archiveTarget = ref<OrgWorkspaceDocumentItem | null>(null)
  const documentFormCategories = ref<OrgDocumentCategory[]>([])
  const documentDetailsModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
  const documentDetailsInitialValues = ref<DocumentFormInitialValues | null>(null)

  const documentCardMenuItems = computed<FloatingMenuItem[]>(() => {
    const items: FloatingMenuItem[] = [
      { key: 'details', label: '資料詳細' },
    ]
    if (isOrgAdmin.value) {
      items.push({ key: 'archive', label: '資料のアーカイブ', danger: true })
    }
    return items
  })

  const documentCardMenu = useFloatingMenuState<number>({
    menuMinWidth: DOCUMENT_CARD_MENU_WIDTH,
    getMenuItemCount: () => documentCardMenuItems.value.length,
      zIndex: 80,
    fixedWidth: true,
  })
  const openDocumentCardMenuId = documentCardMenu.openId
  const documentCardMenuPosition = documentCardMenu.position
  const documentCardMenuStyle = documentCardMenu.style

  const archiveConfirmMessage = computed(() => (
    buildDestructiveConfirmMessage('資料', 'アーカイブ', archiveTarget.value?.name ?? '')
  ))

  function resolveCategoryOption (
    category: OrgDocument['category'] | OrgWorkspaceDocumentItem['category'],
  ): TaskFormCategory | null {
    if (!category) {
      return null
    }
    const resolved = resolveStandardColors([category])[0]
    if (!resolved?.color) {
      return null
    }
    return {
      name: resolved.name,
      color: resolved.color,
    }
  }

  function findListDocument (documentId: number): OrgWorkspaceDocumentItem | null {
    const list = options?.documents ? toValue(options.documents) : []
    return list.find(item => item.id === documentId) ?? null
  }

  async function ensureDocumentFormDataLoaded (): Promise<void> {
    const slug = toValue(orgSlug).trim()
    if (!slug) {
      return
    }
    let snapshot = getCached(slug)
    if (!snapshot) {
      snapshot = await fetchSnapshot(slug).catch(() => null)
    }
    if (!snapshot) {
      return
    }
    documentFormCategories.value = snapshot.documentCategories
  }

  const closeDocumentCardMenu = documentCardMenu.close

  function toggleDocumentCardMenu (documentId: number, event: MouseEvent): void {
    documentCardMenu.toggle(documentId, event)
  }

  function onDocumentCardContextMenu (documentId: number, event: MouseEvent): void {
    documentCardMenu.openFromContextMenu(documentId, event)
  }

  async function openDocumentDetailsModal (documentId: number): Promise<void> {
    closeDocumentCardMenu()
    const slug = toValue(orgSlug).trim()
    if (!slug) {
      return
    }
    await ensureDocumentFormDataLoaded()
    const listItem = findListDocument(documentId)
    let detail: OrgDocument | null = null
    try {
      detail = await fetchDocument(slug, documentId)
    } catch {
      if (!listItem) {
        return
      }
    }
    const name = detail?.name ?? listItem?.name
    if (!name) {
      return
    }
    editingDocumentId.value = documentId
    documentDetailsInitialValues.value = {
      name,
      description: detail?.description ?? listItem?.description ?? null,
      category: resolveCategoryOption(detail?.category ?? listItem?.category ?? null),
    }
    documentDetailsModalOpen.value = true
  }

  function openDocumentArchiveConfirm (documentId: number): void {
    closeDocumentCardMenu()
    const listItem = findListDocument(documentId)
    if (!listItem) {
      return
    }
    archiveTarget.value = listItem
    documentArchiveConfirmOpen.value = true
  }

  function onDocumentCardMenuSelect (item: FloatingMenuItem): void {
    const documentId = openDocumentCardMenuId.value
    if (documentId == null) {
      return
    }
    if (item.key === 'details') {
      void openDocumentDetailsModal(documentId)
      return
    }
    if (item.key === 'archive') {
      openDocumentArchiveConfirm(documentId)
    }
  }

  async function onDocumentDetailsSubmit (payload: {
    name: string
    description: string | null
    category: string | null
  }): Promise<void> {
    const slug = toValue(orgSlug).trim()
    const documentId = editingDocumentId.value
    if (!slug || documentId == null || documentMetaPending.value) {
      return
    }
    documentMetaPending.value = true
    try {
      await withAppLoadingCursor(async () => {
        const updated = await api<OrgDocument>(
          `/orgs/${slug}/documents/${documentId}`,
          {
            method: 'PATCH',
            body: {
              name: payload.name,
              description: payload.description,
              category: payload.category,
            },
          },
        )
        applyDocumentUpdated(slug, updated)
        documentDetailsModalOpen.value = false
        editingDocumentId.value = null
        documentDetailsInitialValues.value = null
        options?.onDocumentUpdated?.(updated)
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '資料の更新に失敗しました'
      documentDetailsModalRef.value?.setSubmitError(message)
    } finally {
      documentMetaPending.value = false
    }
  }

  async function confirmDocumentArchive (): Promise<void> {
    const slug = toValue(orgSlug).trim()
    const target = archiveTarget.value
    if (!slug || !target || archivePending.value) {
      return
    }
    const workspaceIdForCache = Number(toValue(workspaceId))
    if (!Number.isFinite(workspaceIdForCache)) {
      return
    }
    archivePending.value = true
    try {
      await withAppLoadingCursor(async () => {
        await api(`/orgs/${slug}/documents/${target.id}/archive`, {
          method: 'POST',
        })
        applyDocumentArchived(slug, {
          ...target,
          workspace_id: workspaceIdForCache,
        })
        documentArchiveConfirmOpen.value = false
        archiveTarget.value = null
        await options?.onDocumentArchived?.({
          id: target.id,
          name: target.name,
          workspaceId: workspaceIdForCache,
        })
      })
    } catch {
      // アーカイブ失敗時は ConfirmModal を開いたままにする
    } finally {
      archivePending.value = false
    }
  }

  watch(
    () => [toValue(orgSlug), toValue(workspaceId)] as const,
    () => {
      closeDocumentCardMenu()
      documentDetailsModalOpen.value = false
      documentArchiveConfirmOpen.value = false
      editingDocumentId.value = null
      archiveTarget.value = null
      documentDetailsInitialValues.value = null
    },
  )

  return {
    openDocumentCardMenuId,
    documentCardMenuPosition,
    documentCardMenuStyle,
    documentCardMenuItems,
    documentDetailsModalOpen,
    documentArchiveConfirmOpen,
    documentMetaPending,
    archivePending,
    documentFormCategories,
    documentDetailsModalRef,
    documentDetailsInitialValues,
    archiveConfirmMessage,
    toggleDocumentCardMenu,
    onDocumentCardContextMenu,
    closeDocumentCardMenu,
    onDocumentCardMenuSelect,
    onDocumentDetailsSubmit,
    confirmDocumentArchive,
  }
}
