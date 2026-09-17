import { queryClient } from '../lib/queryClient'

import { queryKeys } from '../lib/queryKeys'

import { useApi } from './useApi'

import { resolveStandardColors } from '../utils/colorPresetResolution'

import {
  normalizeDefaultDocumentCategoryItems,
  type OrgSettingsResponse,
} from '../components/settings/types'

import type { TaskFormCategory } from './useTaskFormHelpers'

import { useOrgSettingsResource } from './useOrgSettingsResource'

export type DocumentCategoryOption = TaskFormCategory & {
  color_index: number
}

export type SharedDocument = {
  id: number
  workspace_id: number
  workspace_name?: string | null
  name: string
  description: string | null
  body: string | null
  category: { name: string; color_index: number; color?: string } | null
  archived_at?: string | null
  created_at?: string
  updated_at?: string
}

export type SharedDocumentCategoriesSnapshot = {
  documentCategories: DocumentCategoryOption[]
}

export function clearAllSharedDocumentCaches (): void {
  queryClient.removeQueries({ queryKey: ['documentCategories'] })
  queryClient.removeQueries({ queryKey: ['sharedDocument'] })
}

function resolveDocumentCategories (
  raw: OrgSettingsResponse['default_document_category_names'],
): DocumentCategoryOption[] {
  return resolveStandardColors(normalizeDefaultDocumentCategoryItems(raw))
}

export function getDocumentCached (orgSlug: string, documentId: number | string): SharedDocument | null {
  return queryClient.getQueryData(queryKeys.sharedDocument(orgSlug, documentId)) ?? null
}

export function upsertDocumentCached (orgSlug: string, document: SharedDocument): void {
  queryClient.setQueryData(queryKeys.sharedDocument(orgSlug, document.id), document)
}

export function useSharedDocumentCache () {
  const { api } = useApi()
  const { fetchOrgSettings } = useOrgSettingsResource()

  async function fetchSnapshot (orgSlug: string): Promise<SharedDocumentCategoriesSnapshot> {
    const slug = orgSlug.trim()
    return queryClient.fetchQuery({
      queryKey: queryKeys.documentCategories(slug),
      queryFn: async () => {
        const settingsRes = await fetchOrgSettings(slug)
        const snapshot: SharedDocumentCategoriesSnapshot = {
          documentCategories: resolveDocumentCategories(settingsRes.default_document_category_names),
        }
        return snapshot
      },
      staleTime: 0,
    })
  }

  /** @deprecated 互換用。fetchSnapshot と同じ */
  async function prefetch (orgSlug: string): Promise<SharedDocumentCategoriesSnapshot> {
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): SharedDocumentCategoriesSnapshot | null {
    const slug = orgSlug.trim()
    const cached = queryClient.getQueryData<SharedDocumentCategoriesSnapshot>(queryKeys.documentCategories(slug))
    if (!cached) {
      return null
    }
    if (!Array.isArray(cached.documentCategories)) {
      queryClient.removeQueries({ queryKey: queryKeys.documentCategories(slug), exact: true })
      return null
    }
    return cached
  }

  function invalidateCached (orgSlug: string): void {
    const slug = orgSlug.trim()
    queryClient.removeQueries({ queryKey: queryKeys.documentCategories(slug), exact: true })
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey
        return key[0] === 'sharedDocument' && key[1] === slug
      },
    })
  }

  function clearAllCached (): void {
    clearAllSharedDocumentCaches()
  }

  async function fetchDocument (orgSlug: string, documentId: number | string): Promise<SharedDocument> {
    const slug = orgSlug.trim()
    const key = queryKeys.sharedDocument(slug, documentId)
    const cached = queryClient.getQueryData<SharedDocument>(key)
    if (cached) {
      return cached
    }
    return queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const raw = await api<SharedDocument>(`/orgs/${slug}/documents/${documentId}`)
        return raw
      },
      staleTime: 0,
    })
  }

  /** @deprecated 互換用。fetchDocument と同じ */
  async function prefetchDocument (orgSlug: string, documentId: number | string): Promise<SharedDocument> {
    return fetchDocument(orgSlug, documentId)
  }

  function invalidateDocumentCached (orgSlug: string, documentId: number | string): void {
    queryClient.removeQueries({ queryKey: queryKeys.sharedDocument(orgSlug, documentId), exact: true })
  }

  function removeDocumentCached (orgSlug: string, documentId: number | string): void {
    queryClient.removeQueries({ queryKey: queryKeys.sharedDocument(orgSlug.trim(), documentId), exact: true })
  }

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    invalidateCached,
    fetchDocument,
    prefetchDocument,
    getDocumentCached,
    invalidateDocumentCached,
    removeDocumentCached,
    upsertDocumentCached,
    clearAllCached,
  }
}
