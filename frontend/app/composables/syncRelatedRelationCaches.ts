import type { OrgDocument, OrgDocumentRelatedItem } from './useOrgDocumentsPageData'
import {
  getDocumentCached,
  patchDocumentRelatedCached,
} from './useOrgDocumentsPageData'
import type { OrgWorkspaceRelatedItem } from './useOrgWorkspaceIndexPageData'
import {
  addRelatedDocumentToWorkspaceDetailCache,
  addRelatedWorkspaceToWorkspaceDetailCache,
  removeRelatedDocumentFromWorkspaceDetailCache,
  removeRelatedWorkspaceFromWorkspaceDetailCache,
} from './useWorkspaceDetailMeta'

type RelatedItem = {
  id: number
  name: string
  description?: string | null
}

function toRelatedItem (item: {
  id: number
  name: string
  description?: string | null
}): RelatedItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
  }
}

function diffRelatedIds (
  previous: RelatedItem[],
  next: RelatedItem[],
): { added: RelatedItem[]; removed: RelatedItem[] } {
  const prevIds = new Set(previous.map(item => item.id))
  const nextIds = new Set(next.map(item => item.id))
  return {
    added: next.filter(item => !prevIds.has(item.id)),
    removed: previous.filter(item => !nextIds.has(item.id)),
  }
}

function removeRelatedWorkspaceFromDocumentCache (
  orgSlug: string,
  documentId: number,
  workspaceId: number,
): void {
  const existing = getDocumentCached(orgSlug, documentId)
  if (!existing?.related_workspaces) {
    return
  }
  patchDocumentRelatedCached(orgSlug, documentId, {
    related_workspaces: existing.related_workspaces.filter(item => item.id !== workspaceId),
  })
}

function addRelatedWorkspaceToDocumentCache (
  orgSlug: string,
  documentId: number,
  workspace: RelatedItem,
): void {
  const existing = getDocumentCached(orgSlug, documentId)
  if (!existing) {
    return
  }
  const list = existing.related_workspaces ?? []
  if (list.some(item => item.id === workspace.id)) {
    return
  }
  patchDocumentRelatedCached(orgSlug, documentId, {
    related_workspaces: [...list, workspace],
  })
}

function removeRelatedDocumentFromDocumentCache (
  orgSlug: string,
  documentId: number,
  relatedDocumentId: number,
): void {
  const existing = getDocumentCached(orgSlug, documentId)
  if (!existing?.related_documents) {
    return
  }
  patchDocumentRelatedCached(orgSlug, documentId, {
    related_documents: existing.related_documents.filter(item => item.id !== relatedDocumentId),
  })
}

function addRelatedDocumentToDocumentCache (
  orgSlug: string,
  documentId: number,
  relatedDocument: RelatedItem,
): void {
  const existing = getDocumentCached(orgSlug, documentId)
  if (!existing) {
    return
  }
  const list = existing.related_documents ?? []
  if (list.some(item => item.id === relatedDocument.id)) {
    return
  }
  patchDocumentRelatedCached(orgSlug, documentId, {
    related_documents: [...list, relatedDocument],
  })
}

/** 資料側で関連スペースを同期したあと、相手スペース詳細キャッシュを更新する */
export function syncPeerCachesAfterDocumentRelatedWorkspacesChange (
  orgSlug: string,
  document: Pick<OrgDocument, 'id' | 'name' | 'description'>,
  previous: OrgDocumentRelatedItem[],
  next: OrgDocumentRelatedItem[],
): void {
  const { added, removed } = diffRelatedIds(previous, next)
  const documentItem = toRelatedItem(document)
  for (const workspace of removed) {
    removeRelatedDocumentFromWorkspaceDetailCache(orgSlug, workspace.id, document.id)
  }
  for (const workspace of added) {
    addRelatedDocumentToWorkspaceDetailCache(orgSlug, workspace.id, documentItem)
  }
}

/** 資料側で関連資料を同期したあと、相手資料詳細キャッシュを更新する */
export function syncPeerCachesAfterDocumentRelatedDocumentsChange (
  orgSlug: string,
  document: Pick<OrgDocument, 'id' | 'name' | 'description'>,
  previous: OrgDocumentRelatedItem[],
  next: OrgDocumentRelatedItem[],
): void {
  const { added, removed } = diffRelatedIds(previous, next)
  const documentItem = toRelatedItem(document)
  for (const peer of removed) {
    removeRelatedDocumentFromDocumentCache(orgSlug, peer.id, document.id)
  }
  for (const peer of added) {
    addRelatedDocumentToDocumentCache(orgSlug, peer.id, documentItem)
  }
}

/** スペース側で関連資料を同期したあと、相手資料詳細キャッシュを更新する */
export function syncPeerCachesAfterWorkspaceRelatedDocumentsChange (
  orgSlug: string,
  workspace: { id: number; name: string; description?: string | null },
  previous: OrgWorkspaceRelatedItem[],
  next: OrgWorkspaceRelatedItem[],
): void {
  const { added, removed } = diffRelatedIds(previous, next)
  const workspaceItem = toRelatedItem(workspace)
  for (const document of removed) {
    removeRelatedWorkspaceFromDocumentCache(orgSlug, document.id, workspace.id)
  }
  for (const document of added) {
    addRelatedWorkspaceToDocumentCache(orgSlug, document.id, workspaceItem)
  }
}

/** スペース側で関連スペースを同期したあと、相手スペース詳細キャッシュを更新する */
export function syncPeerCachesAfterWorkspaceRelatedWorkspacesChange (
  orgSlug: string,
  workspace: { id: number; name: string; description?: string | null },
  previous: OrgWorkspaceRelatedItem[],
  next: OrgWorkspaceRelatedItem[],
): void {
  const { added, removed } = diffRelatedIds(previous, next)
  const workspaceItem = toRelatedItem(workspace)
  for (const peer of removed) {
    removeRelatedWorkspaceFromWorkspaceDetailCache(orgSlug, peer.id, workspace.id)
  }
  for (const peer of added) {
    addRelatedWorkspaceToWorkspaceDetailCache(orgSlug, peer.id, workspaceItem)
  }
}
