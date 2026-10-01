import { useApi } from '../shared/useApi'
import { resolveStandardColors } from '../../utils/shared/colorPresetResolution'
import {
  normalizeDefaultDocumentCategoryItems,
  type OrgSettingsResponse,
} from '../../components/settings/types'
import type { TaskFormCategory } from '../task/useTaskFormHelpers'
import { useOrgSettingsResource } from '../settings/useOrgSettingsResource'

export type OrgDocumentCategory = TaskFormCategory & {
  color_index: number
}

export type OrgDocument = {
  id: number
  name: string
  description: string | null
  body: string | null
  category: { name: string; color_index: number; color?: string } | null
  workspace_id?: number
  archived_at?: string | null
  created_at?: string
  updated_at?: string
}
export type OrgDocumentsPageSnapshot = {
  documents: OrgDocument[]
  documentCategories: OrgDocumentCategory[]
}
const cacheBySlug = new Map<string, OrgDocumentsPageSnapshot>()
const documentCacheByKey = new Map<string, OrgDocument>()
const inflightBySlug = new Map<string, Promise<OrgDocumentsPageSnapshot>>()
const documentInflightByKey = new Map<string, Promise<OrgDocument>>()
const snapshotEpochBySlug = new Map<string, number>()
const cacheRevision = ref(0)

function notifyDocumentsCacheChanged (): void {
  cacheRevision.value += 1
}

/** 楽観更新のたびに世代を進め、進行中の一覧 GET を古い応答として捨てる。 */
function bumpDocumentsSnapshotEpoch (orgSlug: string): void {
  const slug = orgSlug.trim()
  snapshotEpochBySlug.set(slug, (snapshotEpochBySlug.get(slug) ?? 0) + 1)
}

export function useOrgDocumentsCacheRevision (): Ref<number> {
  return cacheRevision
}

export function clearAllOrgDocumentsPageCaches (): void {
  cacheBySlug.clear()
  documentCacheByKey.clear()
  inflightBySlug.clear()
  documentInflightByKey.clear()
  snapshotEpochBySlug.clear()
  notifyDocumentsCacheChanged()
}

function documentCacheKey (orgSlug: string, documentId: number | string): string {
  return `${orgSlug.trim()}:${documentId}`
}
function resolveDocumentCategories (
  raw: OrgSettingsResponse['default_document_category_names'],
): OrgDocumentCategory[] {
  return resolveStandardColors(normalizeDefaultDocumentCategoryItems(raw))
}

export function getDocumentCached (orgSlug: string, documentId: number | string): OrgDocument | null {
  return documentCacheByKey.get(documentCacheKey(orgSlug, documentId)) ?? null
}

/** 資料の詳細と一覧を同時に更新し、進行中の GET より新しい世代にする。 */
export function upsertDocumentCached (orgSlug: string, document: OrgDocument): void {
  const slug = orgSlug.trim()
  const key = documentCacheKey(slug, document.id)
  const existingDetail = documentCacheByKey.get(key)
  const next: OrgDocument = {
    ...existingDetail,
    ...document,
  }
  documentCacheByKey.set(key, next)
  bumpDocumentsSnapshotEpoch(slug)
  const snapshot = cacheBySlug.get(slug)
  if (snapshot) {
    const idx = snapshot.documents.findIndex(item => item.id === next.id)
    if (idx < 0) {
      snapshot.documents = [next, ...snapshot.documents]
    } else {
      snapshot.documents[idx] = {
        ...snapshot.documents[idx],
        ...next,
      }
    }
  }
  notifyDocumentsCacheChanged()
}

export function removeDocumentCached (orgSlug: string, documentId: number | string): void {
  const slug = orgSlug.trim()
  const id = Number(documentId)
  documentCacheByKey.delete(documentCacheKey(slug, documentId))
  const snapshot = cacheBySlug.get(slug)
  if (snapshot) {
    snapshot.documents = snapshot.documents.filter(document => document.id !== id)
  }
  bumpDocumentsSnapshotEpoch(slug)
  notifyDocumentsCacheChanged()
}

export function useOrgDocumentsPageData () {
  const { api } = useApi()
  const { fetchOrgSettings } = useOrgSettingsResource()
  async function fetchSnapshot (orgSlug: string): Promise<OrgDocumentsPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const epochAtStart = snapshotEpochBySlug.get(slug) ?? 0
      const [documentsRes, settingsRes] = await Promise.all([
        api<{ data: OrgDocument[] }>(`/orgs/${slug}/documents`),
        fetchOrgSettings(slug),
      ])
      // 取得中に楽観更新があったら、古い一覧で上書きしない
      if ((snapshotEpochBySlug.get(slug) ?? 0) !== epochAtStart) {
        const current = cacheBySlug.get(slug)
        if (current) {
          return current
        }
      }
      const snapshot: OrgDocumentsPageSnapshot = {
        documents: documentsRes.data,
        documentCategories: resolveDocumentCategories(settingsRes.default_document_category_names),
      }
      cacheBySlug.set(slug, snapshot)
      notifyDocumentsCacheChanged()
      return snapshot
    })()
    inflightBySlug.set(slug, job)
    try {
      return await job
    } finally {
      if (inflightBySlug.get(slug) === job) {
        inflightBySlug.delete(slug)
      }
    }
  }
  /** @deprecated 互換用。fetchSnapshot と同じ */
  async function prefetch (orgSlug: string): Promise<OrgDocumentsPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }
  function getCached (orgSlug: string): OrgDocumentsPageSnapshot | null {
    const cached = cacheBySlug.get(orgSlug.trim())
    if (!cached) {
      return null
    }
    if (!Array.isArray(cached.documentCategories) || !Array.isArray(cached.documents)) {
      cacheBySlug.delete(orgSlug.trim())
      return null
    }
    return cached
  }
  function invalidateCached (orgSlug: string): void {
    cacheBySlug.delete(orgSlug.trim())
    const prefix = `${orgSlug.trim()}:`
    for (const key of documentCacheByKey.keys()) {
      if (key.startsWith(prefix)) {
        documentCacheByKey.delete(key)
      }
    }
    bumpDocumentsSnapshotEpoch(orgSlug)
    notifyDocumentsCacheChanged()
  }
  function clearAllCached (): void {
    clearAllOrgDocumentsPageCaches()
  }
  function getDocumentFromListCache (orgSlug: string, documentId: number | string): OrgDocument | null {
    const cached = getCached(orgSlug)
    if (!cached) {
      return null
    }
    const id = Number(documentId)
    return cached.documents.find(document => document.id === id) ?? null
  }
  async function fetchDocument (orgSlug: string, documentId: number | string): Promise<OrgDocument> {
    const slug = orgSlug.trim()
    const id = String(documentId).trim()
    if (!id || id === 'undefined' || !Number.isFinite(Number(id))) {
      throw new Error('Invalid document id')
    }
    const key = documentCacheKey(slug, id)
    const cached = documentCacheByKey.get(key)
    if (cached) {
      return cached
    }
    const inflight = documentInflightByKey.get(key)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const document = await api<OrgDocument>(`/orgs/${slug}/documents/${id}`)
      documentCacheByKey.set(key, document)
      return document
    })()
    documentInflightByKey.set(key, job)
    try {
      return await job
    } finally {
      if (documentInflightByKey.get(key) === job) {
        documentInflightByKey.delete(key)
      }
    }
  }
  /** @deprecated 互換用。fetchDocument と同じ */
  async function prefetchDocument (orgSlug: string, documentId: number | string): Promise<OrgDocument> {
    return fetchDocument(orgSlug, documentId)
  }
  function invalidateDocumentCached (orgSlug: string, documentId: number | string): void {
    documentCacheByKey.delete(documentCacheKey(orgSlug, documentId))
  }
  return {
    fetchSnapshot,
    prefetch,
    getCached,
    invalidateCached,
    fetchDocument,
    prefetchDocument,
    getDocumentCached,
    getDocumentFromListCache,
    invalidateDocumentCached,
    removeDocumentCached,
    upsertDocumentCached,
    clearAllCached,
  }
}
