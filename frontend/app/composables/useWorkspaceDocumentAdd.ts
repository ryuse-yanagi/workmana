import type { OrgDocumentCategory } from './useOrgDocumentsPageData'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import { useApi } from './useApi'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
} from './useOrgDocumentsPageData'
import { addDocumentToWorkspaceDetailCache } from './useWorkspaceDetailMeta'

export function useWorkspaceDocumentAdd (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
) {
  const { api } = useApi()
  const { getCached, fetchSnapshot, upsertDocumentCached } = useOrgDocumentsPageData()

  const documentAddModalOpen = ref(false)
  const documentAddPending = ref(false)
  const documentAddModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
  const documentFormCategories = ref<OrgDocumentCategory[]>([])

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

  async function openDocumentAddModal (): Promise<void> {
    await ensureDocumentFormDataLoaded()
    documentAddModalOpen.value = true
  }

  async function onDocumentAddSubmit (payload: {
    name: string
    description: string | null
    category: string | null
  }): Promise<void> {
    const slug = toValue(orgSlug).trim()
    const wsId = toValue(workspaceId)
    if (!slug || wsId === '' || wsId == null || documentAddPending.value) {
      return
    }
    documentAddPending.value = true
    try {
      await withAppLoadingCursor(async () => {
        const created = await api<OrgDocument>(
          `/orgs/${slug}/workspaces/${wsId}/documents`,
          {
            method: 'POST',
            body: {
              name: payload.name,
              description: payload.description,
              category: payload.category,
            },
          },
        )
        upsertDocumentCached(slug, created)
        addDocumentToWorkspaceDetailCache(slug, wsId, {
          id: created.id,
          name: created.name,
          description: created.description ?? null,
          category: created.category ?? null,
        })
        documentAddModalOpen.value = false
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '資料の追加に失敗しました'
      documentAddModalRef.value?.setSubmitError(message)
    } finally {
      documentAddPending.value = false
    }
  }

  return {
    documentAddModalOpen,
    documentAddPending,
    documentAddModalRef,
    documentFormCategories,
    openDocumentAddModal,
    onDocumentAddSubmit,
  }
}
