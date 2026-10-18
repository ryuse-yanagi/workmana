import {
  getDocumentCached,
  removeDocumentCached,
  upsertDocumentCached,
  type OrgDocument,
} from './useOrgDocumentsPageData'
import {
  dropInFlightWorkspaceItemQuery,
  patchDocumentInAllCachedWorkspaces,
  removeDocumentFromAllCachedWorkspaces,
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceDocumentItem,
} from '../workspace/useOrgWorkspaceIndexPageData'
import {
  removeArchivedDocumentFromLists,
  upsertArchivedNamedItem,
  type ArchivedNamedItem,
} from '../archived/useArchivedNamedItemsCache'

function toWorkspaceDocumentItem (document: {
  id: number
  name: string
  description?: string | null
  category?: OrgWorkspaceDocumentItem['category']
}): OrgWorkspaceDocumentItem {
  return {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category ?? null,
  }
}

function owningWorkspaceId (document: { workspace_id?: number | null }): number | null {
  if (document.workspace_id == null || !Number.isFinite(Number(document.workspace_id))) {
    return null
  }
  return Number(document.workspace_id)
}

function toArchivedNamedItem (document: {
  id: number
  name: string
  description?: string | null
  category?: OrgWorkspaceDocumentItem['category']
  body?: string | null
  archived_at?: string | null
  created_at?: string
  updated_at?: string
  workspace_id?: number
  workspace_name?: string | null
}): ArchivedNamedItem {
  return {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category ?? null,
    body: document.body ?? null,
    archived_at: document.archived_at ?? new Date().toISOString(),
    created_at: document.created_at,
    updated_at: document.updated_at,
    workspace_id: document.workspace_id,
    workspace_name: document.workspace_name ?? null,
  }
}

function toOrgDocument (
  orgSlug: string,
  document: {
    id: number
    name: string
    description?: string | null
    body?: string | null
    category?: OrgDocument['category']
    workspace_id?: number
    archived_at?: string | null
    created_at?: string
    updated_at?: string
  },
): OrgDocument {
  const existing = getDocumentCached(orgSlug, document.id)
  return {
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    body: document.body ?? existing?.body ?? null,
    category: document.category ?? null,
    workspace_id: document.workspace_id ?? existing?.workspace_id,
    archived_at: document.archived_at ?? null,
    created_at: document.created_at ?? existing?.created_at,
    updated_at: document.updated_at ?? existing?.updated_at,
  }
}

/** 資料の作成を、一覧・詳細・所属スペースのサイドバーへ同時反映する */
export function applyDocumentCreated (
  orgSlug: string,
  document: OrgDocument,
  extraWorkspaceIds: Array<string | number> = [],
): void {
  const slug = orgSlug.trim()
  if (!slug) {
    return
  }
  upsertDocumentCached(slug, document)
  const ownerId = owningWorkspaceId(document)
  const workspaceIds = [
    ...(ownerId == null ? [] : [ownerId]),
    ...extraWorkspaceIds.map(id => Number(id)).filter(Number.isFinite),
  ]
  patchDocumentInAllCachedWorkspaces(slug, toWorkspaceDocumentItem(document), {
    addToWorkspaceIds: workspaceIds,
  })
  for (const workspaceId of new Set(workspaceIds)) {
    dropInFlightWorkspaceItemQuery(slug, workspaceId)
  }
  refreshWorkspaceDocuments(slug, workspaceIds)
}

/** 資料の更新を、一覧・詳細・所属スペースのサイドバーへ同時反映する */
export function applyDocumentUpdated (orgSlug: string, document: OrgDocument): void {
  const slug = orgSlug.trim()
  if (!slug) {
    return
  }
  upsertDocumentCached(slug, document)
  const ownerId = owningWorkspaceId(document)
  patchDocumentInAllCachedWorkspaces(slug, toWorkspaceDocumentItem(document), {
    addToWorkspaceIds: ownerId == null ? [] : [ownerId],
  })
}

/** 資料のアーカイブを、一覧・全スペースサイドバー・アーカイブ一覧へ同時反映する */
export function applyDocumentArchived (
  orgSlug: string,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentItem['category']
    body?: string | null
    workspace_id?: number | null
    archived_at?: string | null
    created_at?: string
    updated_at?: string
  },
): void {
  const slug = orgSlug.trim()
  if (!slug) {
    return
  }
  const cached = getDocumentCached(slug, document.id)
  const ownerId = owningWorkspaceId(cached ?? {}) ?? owningWorkspaceId(document)
  removeDocumentCached(slug, document.id)
  const removedFrom = removeDocumentFromAllCachedWorkspaces(slug, document.id)
  const workspaceIds = [...new Set([...(ownerId == null ? [] : [ownerId]), ...removedFrom])]
  const archived = toArchivedNamedItem(document)
  upsertArchivedNamedItem({ orgSlug: slug, resource: 'documents' }, archived)
  for (const workspaceId of workspaceIds) {
    dropInFlightWorkspaceItemQuery(slug, workspaceId)
    upsertArchivedNamedItem(
      { orgSlug: slug, resource: 'documents', workspaceId },
      archived,
    )
  }
}

/** 資料の復元を、一覧・スペースサイドバーへ同時反映し、アーカイブ一覧から除く */
export function applyDocumentRestored (
  orgSlug: string,
  document: {
    id: number
    name: string
    description?: string | null
    category?: OrgWorkspaceDocumentItem['category']
    body?: string | null
    archived_at?: string | null
    created_at?: string
    updated_at?: string
    workspace_id?: number
    workspace_name?: string | null
  },
  extraWorkspaceIds: Array<string | number> = [],
): void {
  const slug = orgSlug.trim()
  if (!slug) {
    return
  }
  const existing = getDocumentCached(slug, document.id)
  const restored = toOrgDocument(slug, {
    ...document,
    archived_at: null,
  })
  // アーカイブ配信は本文を含まない。空の本文で詳細キャッシュを埋めると、開いたときに再取得しない。
  if (document.body != null || existing?.body != null) {
    upsertDocumentCached(slug, restored)
  }
  const ownerId = owningWorkspaceId(restored)
  const workspaceIds = [
    ...(ownerId == null ? [] : [ownerId]),
    ...extraWorkspaceIds.map(id => Number(id)).filter(Number.isFinite),
  ]
  patchDocumentInAllCachedWorkspaces(slug, toWorkspaceDocumentItem(restored), {
    addToWorkspaceIds: workspaceIds,
  })
  removeArchivedDocumentFromLists(slug, document.id, ownerId)
  for (const workspaceId of new Set(workspaceIds)) {
    dropInFlightWorkspaceItemQuery(slug, workspaceId)
  }
  refreshWorkspaceDocuments(slug, workspaceIds)
}

/** クリック操作のときだけ、所属スペースの資料一覧を取り直す。 */
function refreshWorkspaceDocuments(orgSlug: string, workspaceIds: number[]): void {
  if (!workspaceIds.length) {
    return
  }
  try {
    const { fetchAndUpsertWorkspace } = useOrgWorkspaceIndexPageData()
    for (const workspaceId of new Set(workspaceIds)) {
      void fetchAndUpsertWorkspace(orgSlug, workspaceId, { force: true }).catch(() => {})
    }
  } catch {
    // リアルタイムの受信時は Nuxt の文脈が無い。キャッシュ更新だけで反映する。
  }
}

/** 完全削除を、一覧・全スペースサイドバー・アーカイブ一覧から除く */
export function applyDocumentPermanentlyDeleted (
  orgSlug: string,
  documentId: number,
  workspaceId?: number | null,
): void {
  const slug = orgSlug.trim()
  if (!slug) {
    return
  }
  const cached = getDocumentCached(slug, documentId)
  const ownerId = workspaceId ?? owningWorkspaceId(cached ?? {})
  removeDocumentCached(slug, documentId)
  const removedFrom = removeDocumentFromAllCachedWorkspaces(slug, documentId)
  for (const id of new Set([...(ownerId == null ? [] : [ownerId]), ...removedFrom])) {
    dropInFlightWorkspaceItemQuery(slug, id)
  }
  removeArchivedDocumentFromLists(slug, documentId, ownerId)
}
