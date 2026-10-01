import type { OrgDocumentCategory } from './useOrgDocumentsPageData'
import { withAppLoadingCursor } from '../ui/useAppLoadingCursor'
import { useApi } from '../shared/useApi'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
} from './useOrgDocumentsPageData'
import { applyDocumentCreated } from './syncDocumentCaches'

export function useWorkspaceDocumentAdd (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
) {
  const { api } = useApi()
  const { getCached, fetchSnapshot } = useOrgDocumentsPageData()

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
        applyDocumentCreated(slug, created, [wsId])
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
