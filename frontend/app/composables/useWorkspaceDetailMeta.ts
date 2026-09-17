import { queryClient } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import {
  useOrgWorkspaceIndexPageData,
  useOrgWorkspaceIndexCacheRevision,
  type OrgWorkspaceItem,
  type OrgWorkspaceLabel,
  type OrgWorkspaceStatus,
  type OrgWorkspaceDocumentCategory,
} from './useOrgWorkspaceIndexPageData'
import { upsertDocumentCached, type OrgDocument } from './useOrgDocumentsPageData'
import type { LabelCategoryGroup } from './useLabelCategories'

export type WorkspaceDetailMeta = {
  workspace: OrgWorkspaceItem
  orgLabels: OrgWorkspaceLabel[]
  orgLabelCategories: LabelCategoryGroup[]
  workspaceStatuses: OrgWorkspaceStatus[]
}

export function prefetchWorkspaceDetail (
  orgSlug: string,
  workspaceId: string | number,
  opts?: { force?: boolean },
): Promise<WorkspaceDetailMeta> {
  return buildWorkspaceDetailMeta(orgSlug, workspaceId, { force: opts?.force ?? false })
}

/** 表示後に裏で最新化（アーカイブ判定・漏れ補正） */
export function revalidateWorkspaceDetailInBackground (
  orgSlug: string,
  workspaceId: string | number,
): void {
  const { revalidateWorkspaceInBackground } = useOrgWorkspaceIndexPageData()
  revalidateWorkspaceInBackground(orgSlug, workspaceId)
}

export function getCachedWorkspaceDetailItem (
  orgSlug: string,
  workspaceId: string | number,
): OrgWorkspaceItem | null {
  const { getWorkspaceFromListCache } = useOrgWorkspaceIndexPageData()
  return getWorkspaceFromListCache(orgSlug, workspaceId)
}

export function warmWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
): void {
  const { warmWorkspaceCache } = useOrgWorkspaceIndexPageData()
  warmWorkspaceCache(orgSlug, workspaceId)
}

export function removeDocumentFromWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  documentId: number,
): void {
  const { removeDocumentFromWorkspaceCache } = useOrgWorkspaceIndexPageData()
  removeDocumentFromWorkspaceCache(orgSlug, workspaceId, documentId)
}

export function addDocumentToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentCategory | null
  },
): void {
  const { addDocumentToWorkspaceCache } = useOrgWorkspaceIndexPageData()
  addDocumentToWorkspaceCache(orgSlug, workspaceId, {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category ?? null,
  })
}

export function updateDocumentInWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentCategory | null
  },
): void {
  const { updateDocumentInWorkspaceCache } = useOrgWorkspaceIndexPageData()
  updateDocumentInWorkspaceCache(orgSlug, workspaceId, {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category ?? null,
  })
}

/** アーカイブ復元直後にサイドバーへ反映し、進行中の stale 再取得で消えないようにする */
export function restoreDocumentToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentCategory | null
    workspace_id?: number
    workspace_name?: string | null
    body?: string | null
    archived_at?: string | null
    created_at?: string
    updated_at?: string
  },
): void {
  const slug = orgSlug.trim()
  const id = String(workspaceId).trim()
  if (!slug || !id) {
    return
  }

  const itemKey = queryKeys.orgWorkspaceItem(slug, id)
  void queryClient.cancelQueries({ queryKey: itemKey })
  queryClient.removeQueries({ queryKey: itemKey, exact: true })

  updateDocumentInWorkspaceDetailCache(slug, workspaceId, {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category ?? null,
  })

  const restoredDocument: OrgDocument = {
    id: document.id,
    workspace_id: document.workspace_id ?? Number(workspaceId),
    workspace_name: document.workspace_name ?? null,
    name: document.name,
    description: document.description ?? null,
    body: document.body ?? null,
    category: document.category ?? null,
    archived_at: document.archived_at ?? null,
    created_at: document.created_at,
    updated_at: document.updated_at,
  }
  upsertDocumentCached(slug, restoredDocument)

  const { fetchAndUpsertWorkspace } = useOrgWorkspaceIndexPageData()
  void fetchAndUpsertWorkspace(slug, workspaceId, { force: true }).catch(() => {})
}

function patchWorkspaceRelatedLists (
  orgSlug: string,
  workspaceId: string | number,
  mutate: (workspace: OrgWorkspaceItem) => OrgWorkspaceItem,
): void {
  const { patchCachedWorkspace } = useOrgWorkspaceIndexPageData()
  patchCachedWorkspace(orgSlug, Number(workspaceId), mutate)
}

export function removeRelatedDocumentFromWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  documentId: number,
): void {
  patchWorkspaceRelatedLists(orgSlug, workspaceId, workspace => ({
    ...workspace,
    related_documents: (workspace.related_documents ?? []).filter(item => item.id !== documentId),
  }))
}

export function addRelatedDocumentToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: { id: number; name: string; description?: string | null },
): void {
  patchWorkspaceRelatedLists(orgSlug, workspaceId, (workspace) => {
    const list = workspace.related_documents ?? []
    if (list.some(item => item.id === document.id)) {
      return workspace
    }
    return {
      ...workspace,
      related_documents: [
        ...list,
        {
          id: document.id,
          name: document.name,
          description: document.description ?? null,
        },
      ],
    }
  })
}

export function removeRelatedWorkspaceFromWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  relatedWorkspaceId: number,
): void {
  patchWorkspaceRelatedLists(orgSlug, workspaceId, workspace => ({
    ...workspace,
    related_workspaces: (workspace.related_workspaces ?? []).filter(item => item.id !== relatedWorkspaceId),
  }))
}

export function addRelatedWorkspaceToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  relatedWorkspace: { id: number; name: string; description?: string | null },
): void {
  patchWorkspaceRelatedLists(orgSlug, workspaceId, (workspace) => {
    const list = workspace.related_workspaces ?? []
    if (list.some(item => item.id === relatedWorkspace.id)) {
      return workspace
    }
    return {
      ...workspace,
      related_workspaces: [
        ...list,
        {
          id: relatedWorkspace.id,
          name: relatedWorkspace.name,
          description: relatedWorkspace.description ?? null,
        },
      ],
    }
  })
}

async function buildWorkspaceDetailMeta (
  orgSlug: string,
  workspaceId: string | number,
  opts?: { force?: boolean },
): Promise<WorkspaceDetailMeta> {
  const {
    getCached,
    fetchSnapshot,
    fetchAndUpsertWorkspace,
  } = useOrgWorkspaceIndexPageData()

  const slug = orgSlug.trim()
  let indexSnapshot = getCached(slug)
  if (!indexSnapshot) {
    indexSnapshot = await fetchSnapshot(slug).catch(() => null)
  }

  const workspace = await fetchAndUpsertWorkspace(slug, workspaceId, opts)

  return {
    workspace,
    orgLabels: indexSnapshot?.orgLabels ?? [],
    orgLabelCategories: indexSnapshot?.orgLabelCategories ?? [],
    workspaceStatuses: indexSnapshot?.workspaceStatuses ?? [],
  }
}

export function useWorkspaceDetailMeta (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
) {
  const cacheRevision = useOrgWorkspaceIndexCacheRevision()
  const {
    getCached,
    fetchSnapshot,
    upsertCachedWorkspace,
    fetchAndUpsertWorkspace,
    invalidateCached,
    revalidateWorkspaceInBackground,
  } = useOrgWorkspaceIndexPageData()

  const workspace = computed(() => {
    void cacheRevision.value
    return getWorkspaceFromListCacheComputed(orgSlug, workspaceId)
  })

  const orgLabels = computed(() => {
    void cacheRevision.value
    return getCached(toValue(orgSlug).trim())?.orgLabels ?? []
  })

  const orgLabelCategories = computed(() => {
    void cacheRevision.value
    return getCached(toValue(orgSlug).trim())?.orgLabelCategories ?? []
  })

  const workspaceStatuses = computed(() => {
    void cacheRevision.value
    return getCached(toValue(orgSlug).trim())?.workspaceStatuses ?? []
  })

  const loaded = computed(() => workspace.value != null)
  const detailFetched = computed(() => workspace.value != null)

  function getWorkspaceFromListCacheComputed (
    slugRef: MaybeRefOrGetter<string>,
    idRef: MaybeRefOrGetter<string | number>,
  ): OrgWorkspaceItem | null {
    const slug = toValue(slugRef).trim()
    const id = toValue(idRef)
    if (!slug || id === '' || id == null) {
      return null
    }
    const cached = getCached(slug)
    if (!cached) {
      return null
    }
    const numericId = Number(id)
    return cached.workspaces.find(item => item.id === numericId) ?? null
  }

  function applyWorkspace (value: OrgWorkspaceItem) {
    upsertCachedWorkspace(toValue(orgSlug).trim(), value)
  }

  async function fetchMeta (force = false): Promise<WorkspaceDetailMeta> {
    return buildWorkspaceDetailMeta(
      toValue(orgSlug),
      toValue(workspaceId),
      { force },
    )
  }

  async function ensureLoaded (): Promise<void> {
    const slug = toValue(orgSlug).trim()
    const id = toValue(workspaceId)
    if (!slug || id === '' || id == null) {
      return
    }
    if (!getCached(slug)) {
      await fetchSnapshot(slug).catch(() => null)
    }
    const cachedItem = getWorkspaceFromListCacheComputed(orgSlug, workspaceId)
    if (cachedItem) {
      revalidateWorkspaceInBackground(slug, id)
      return
    }
    await fetchAndUpsertWorkspace(slug, id)
  }

  function invalidate (): void {
    invalidateCached(toValue(orgSlug).trim())
  }

  watch(
    () => [toValue(orgSlug), toValue(workspaceId)] as const,
    ([slug, id]) => {
      if (!slug || id === '' || id == null) {
        return
      }
      void ensureLoaded()
    },
    { immediate: true },
  )

  return {
    workspace,
    orgLabels,
    orgLabelCategories,
    workspaceStatuses,
    loaded,
    detailFetched,
    ensureLoaded,
    fetchMeta,
    applyWorkspace,
    invalidate,
  }
}
