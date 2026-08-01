import { useApi } from './useApi'
import { resolveLabelColors, resolveStandardColors } from '../utils/colorPresetResolution'
import {
  normalizeDefaultDocumentCategoryItems,
  type OrgSettingsResponse,
} from '../components/settings/types'
import type { TaskFormCategory, TaskFormLabel } from './useTaskFormHelpers'

export type OrgDocumentLabel = {
  id: number
  category_id: number
  name: string
  color_index: number
  color: string
}
export type OrgDocumentCategory = TaskFormCategory & {
  color_index: number
}
export type OrgDocumentRelatedItem = {
  id: number
  name: string
  description?: string | null
}

export type OrgDocument = {
  id: number
  name: string
  description: string | null
  body: string | null
  category: { name: string; color_index: number; color?: string } | null
  labels: OrgDocumentLabel[]
  related_workspaces?: OrgDocumentRelatedItem[]
  related_documents?: OrgDocumentRelatedItem[]
  archived_at?: string | null
  created_at?: string
  updated_at?: string
}
export type OrgDocumentsPageSnapshot = {
  documents: OrgDocument[]
  documentCategories: OrgDocumentCategory[]
  documentLabels: TaskFormLabel[]
}
const cacheBySlug = new Map<string, OrgDocumentsPageSnapshot>()
const documentCacheByKey = new Map<string, OrgDocument>()
const inflightBySlug = new Map<string, Promise<OrgDocumentsPageSnapshot>>()
const documentInflightByKey = new Map<string, Promise<OrgDocument>>()

export function clearAllOrgDocumentsPageCaches (): void {
  cacheBySlug.clear()
  documentCacheByKey.clear()
  inflightBySlug.clear()
  documentInflightByKey.clear()
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

export function upsertDocumentCached (orgSlug: string, document: OrgDocument): void {
  const slug = orgSlug.trim()
  const next: OrgDocument = {
    ...document,
    labels: resolveLabelColors(document.labels ?? []),
  }
  documentCacheByKey.set(documentCacheKey(slug, next.id), next)
  const snapshot = cacheBySlug.get(slug)
  if (!snapshot) {
    return
  }
  const idx = snapshot.documents.findIndex(item => item.id === next.id)
  if (idx < 0) {
    return
  }
  snapshot.documents[idx] = {
    ...snapshot.documents[idx],
    ...next,
  }
}

export function patchDocumentRelatedCached (
  orgSlug: string,
  documentId: number | string,
  patch: {
    related_workspaces?: OrgDocumentRelatedItem[]
    related_documents?: OrgDocumentRelatedItem[]
  },
): void {
  const existing = getDocumentCached(orgSlug, documentId)
  if (!existing) {
    return
  }
  upsertDocumentCached(orgSlug, {
    ...existing,
    ...patch,
  })
}

export function useOrgDocumentsPageData () {
  const { api } = useApi()
  async function fetchSnapshot (orgSlug: string): Promise<OrgDocumentsPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const [documentsRes, labelsRes, settingsRes] = await Promise.all([
        api<{ data: OrgDocument[] }>(`/orgs/${slug}/documents`),
        api<{ data: OrgDocumentLabel[] }>(`/orgs/${slug}/document-labels`),
        api<OrgSettingsResponse>(`/orgs/${slug}/settings`),
      ])
      const snapshot: OrgDocumentsPageSnapshot = {
        documents: documentsRes.data.map(document => ({
          ...document,
          labels: resolveLabelColors(document.labels ?? []),
        })),
        documentCategories: resolveDocumentCategories(settingsRes.default_document_category_names),
        documentLabels: resolveLabelColors(labelsRes.data),
      }
      cacheBySlug.set(slug, snapshot)
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
    if (!Array.isArray(cached.documentCategories) || !Array.isArray(cached.documentLabels)) {
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
    const key = documentCacheKey(slug, documentId)
    const cached = documentCacheByKey.get(key)
    if (
      cached
      && cached.related_workspaces !== undefined
      && cached.related_documents !== undefined
    ) {
      return cached
    }
    const inflight = documentInflightByKey.get(key)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const raw = await api<OrgDocument>(`/orgs/${slug}/documents/${documentId}`)
      const document: OrgDocument = {
        ...raw,
        labels: resolveLabelColors(raw.labels ?? []),
        related_workspaces: raw.related_workspaces ?? [],
        related_documents: raw.related_documents ?? [],
      }
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
  function removeDocumentCached (orgSlug: string, documentId: number | string): void {
    const slug = orgSlug.trim()
    const id = Number(documentId)
    documentCacheByKey.delete(documentCacheKey(slug, documentId))
    const snapshot = cacheBySlug.get(slug)
    if (!snapshot) {
      return
    }
    snapshot.documents = snapshot.documents.filter(document => document.id !== id)
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
