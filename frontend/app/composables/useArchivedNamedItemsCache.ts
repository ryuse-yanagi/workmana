import { queryClient } from '../lib/queryClient'

import { queryKeys } from '../lib/queryKeys'

import { useApi } from './useApi'

export type ArchivedNamedItem = {

  id: number

  name: string

  description?: string | null

  archived_at?: string | null

  workspace_id?: number

  workspace_name?: string | null

  body?: string | null

  category?: { name: string; color_index: number; color?: string } | null

  created_at?: string

  updated_at?: string

}

export type ArchivedNamedItemsResource = 'workspaces' | 'documents'

export type ArchivedNamedItemsCacheKeyInput = {

  orgSlug: string

  resource: ArchivedNamedItemsResource

  workspaceId?: string | number | null

}

function listPath (input: ArchivedNamedItemsCacheKeyInput): string {

  const slug = input.orgSlug.trim()

  if (input.resource === 'documents' && input.workspaceId != null && input.workspaceId !== '') {

    return `/orgs/${slug}/workspaces/${input.workspaceId}/documents/archived`

  }

  return `/orgs/${slug}/${input.resource}/archived`

}

function resolveQueryKey (input: ArchivedNamedItemsCacheKeyInput) {

  return queryKeys.archivedNamedItems(input.orgSlug, input.resource, input.workspaceId)

}

export function clearAllArchivedNamedItemsCaches (): void {

  queryClient.removeQueries({ queryKey: ['archivedNamedItems'] })

}

export function useArchivedNamedItemsCache () {

  const { api } = useApi()

  function getCached (input: ArchivedNamedItemsCacheKeyInput): ArchivedNamedItem[] | null {

    return queryClient.getQueryData(resolveQueryKey(input)) ?? null

  }

  function setCached (input: ArchivedNamedItemsCacheKeyInput, items: ArchivedNamedItem[]): void {

    queryClient.setQueryData(resolveQueryKey(input), items.map(item => ({ ...item })))

  }

  function invalidateCached (input: ArchivedNamedItemsCacheKeyInput): void {

    queryClient.removeQueries({ queryKey: resolveQueryKey(input), exact: true })

  }

  function invalidateArchivedWorkspaces (orgSlug: string): void {

    invalidateCached({ orgSlug, resource: 'workspaces' })

  }

  function removeCachedItem (input: ArchivedNamedItemsCacheKeyInput, itemId: number): void {

    const key = resolveQueryKey(input)

    const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key)

    if (!cached) return

    queryClient.setQueryData(key, cached.filter(item => item.id !== itemId))

  }

  function upsertCachedItem (input: ArchivedNamedItemsCacheKeyInput, item: ArchivedNamedItem): void {

    const key = resolveQueryKey(input)

    const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key)

    if (!cached) return

    const index = cached.findIndex(existing => existing.id === item.id)

    if (index >= 0) {

      const next = [...cached]

      next[index] = { ...item }

      queryClient.setQueryData(key, next)

      return

    }

    queryClient.setQueryData(key, [{ ...item }, ...cached])

  }

  async function fetchList (

    input: ArchivedNamedItemsCacheKeyInput,

    opts?: { refresh?: boolean },

  ): Promise<ArchivedNamedItem[]> {

    const key = resolveQueryKey(input)

    if (opts?.refresh) {

      queryClient.removeQueries({ queryKey: key, exact: true })

    } else {

      const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key)

      if (cached) {

        return cached.map(item => ({ ...item }))

      }

    }

    const items = await queryClient.fetchQuery({

      queryKey: key,

      queryFn: async () => {

        const response = await api<{ data: ArchivedNamedItem[] }>(listPath(input))

        return response.data.map(item => ({ ...item }))

      },

      staleTime: 0,

    })

    return items.map(item => ({ ...item }))

  }

  return {

    getCached,

    setCached,

    invalidateCached,

    invalidateArchivedWorkspaces,

    removeCachedItem,

    upsertCachedItem,

    fetchList,

    clearAllCached: clearAllArchivedNamedItemsCaches,

  }

}

