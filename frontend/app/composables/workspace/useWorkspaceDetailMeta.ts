import {
  useOrgWorkspaceIndexPageData,
  useOrgWorkspaceIndexCacheRevision,
  type OrgWorkspaceItem,
  type OrgWorkspaceLabel,
  type OrgWorkspaceStatus,
  type OrgWorkspaceDocumentCategory,
} from './useOrgWorkspaceIndexPageData'
import { applyDocumentCreated, applyDocumentRestored, applyDocumentUpdated } from '../document/syncDocumentCaches'
import { getDocumentCached } from '../document/useOrgDocumentsPageData'
import type { LabelCategoryGroup } from '../label/useLabelCategories'

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

/** 全スペースのサイドバーから外し、指定スペースに残っていればそこも消す。 */
export function removeDocumentFromWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  documentId: number,
): void {
  const { removeDocumentFromAllCachedWorkspaces } = useOrgWorkspaceIndexPageData()
  const removedFrom = removeDocumentFromAllCachedWorkspaces(orgSlug, documentId)
  if (!removedFrom.includes(Number(workspaceId))) {
    const { removeDocumentFromWorkspaceCache } = useOrgWorkspaceIndexPageData()
    removeDocumentFromWorkspaceCache(orgSlug, workspaceId, documentId)
  }
}

/** 資料追加直後にサイドバーへ反映し、進行中の stale 再取得で消えないようにする */
export function addDocumentToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentCategory | null
    body?: string | null
    workspace_id?: number
    created_at?: string
    updated_at?: string
  },
): void {
  applyDocumentCreated(orgSlug, {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    body: document.body ?? null,
    category: document.category ?? null,
    workspace_id: document.workspace_id ?? Number(workspaceId),
    created_at: document.created_at,
    updated_at: document.updated_at,
  }, [workspaceId])
}

/** 渡された項目だけを差し替え、本文はキャッシュに残っているものを維持する。 */
export function updateDocumentInWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentCategory | null
    workspace_id?: number
  },
): void {
  const existing = getDocumentCached(orgSlug, document.id)
  applyDocumentUpdated(orgSlug, {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    body: existing?.body ?? null,
    category: document.category ?? null,
    workspace_id: document.workspace_id ?? existing?.workspace_id ?? Number(workspaceId),
    created_at: existing?.created_at,
    updated_at: existing?.updated_at,
  })
  const { patchDocumentInAllCachedWorkspaces } = useOrgWorkspaceIndexPageData()
  patchDocumentInAllCachedWorkspaces(orgSlug, {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category ?? null,
  }, { addToWorkspaceIds: [workspaceId] })
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
  applyDocumentRestored(orgSlug, document, [workspaceId])
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
    const idText = String(id ?? '').trim()
    if (!slug || !idText || idText === 'undefined' || !Number.isFinite(Number(idText))) {
      return null
    }
    const cached = getCached(slug)
    if (!cached) {
      return null
    }
    const numericId = Number(idText)
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
    const idText = String(id ?? '').trim()
    if (!slug || !idText || idText === 'undefined' || !Number.isFinite(Number(idText))) {
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
      const idText = String(id ?? '').trim()
      if (!slug || !idText || idText === 'undefined' || !Number.isFinite(Number(idText))) {
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
