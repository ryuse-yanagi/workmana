import type { OrgDocumentCategory } from './useOrgDocumentsPageData'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import { useApi } from './useApi'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
} from './useOrgDocumentsPageData'
import type { OrgWorkspaceDocumentCategory } from './useOrgWorkspaceIndexPageData'
import { addDocumentToWorkspaceDetailCache } from './useWorkspaceDetailMeta'

export function useWorkspaceDocumentCreate (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
) {
  const router = useRouter()
  const { api } = useApi()
  const { getCached, fetchSnapshot, upsertDocumentCached } = useOrgDocumentsPageData()

  const documentCreateModalOpen = ref(false)
  const documentCreatePending = ref(false)
  const documentCreateModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
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

  async function openDocumentCreateModal (): Promise<void> {
    await ensureDocumentFormDataLoaded()
    documentCreateModalOpen.value = true
  }

  async function onDocumentCreateSubmit (payload: {
    name: string
    description: string | null
    category: string | null
  }): Promise<void> {
    const slug = toValue(orgSlug).trim()
    const wsId = toValue(workspaceId)
    if (!slug || wsId === '' || wsId == null || documentCreatePending.value) {
      return
    }
    documentCreatePending.value = true
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
        documentCreateModalOpen.value = false
        await router.push(`/org/${slug}/documents/${created.id}`)
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '資料の追加に失敗しました'
      documentCreateModalRef.value?.setSubmitError(message)
    } finally {
      documentCreatePending.value = false
    }
  }

  return {
    documentCreateModalOpen,
    documentCreatePending,
    documentCreateModalRef,
    documentFormCategories,
    openDocumentCreateModal,
    onDocumentCreateSubmit,
  }
}
