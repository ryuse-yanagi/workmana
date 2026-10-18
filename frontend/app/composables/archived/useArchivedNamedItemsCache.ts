import { queryClient } from '../../lib/queryClient'
import { queryKeys } from '../../lib/queryKeys'
import { useApi } from '../shared/useApi'
import { createListWriteGuard } from './listWriteGuard'

const archivedNamedItemsRevision = ref(0)
const listWrites = createListWriteGuard<ArchivedNamedItem>()

export function useArchivedNamedItemsRevision(): Ref<number> {
  return archivedNamedItemsRevision
}

function touchArchivedNamedItems(): void {
  archivedNamedItemsRevision.value += 1
}

export type ArchivedNamedItem = {
  id: number
  name: string
  description?: string | null
  archived_at?: string | null
  workspace_id?: number
  workspace_name?: string | null
  body?: string | null
  category?: { name: string; color_index: number; color?: string } | null
  status?: { name: string; color_index: number; color?: string } | null
  labels?: Array<{ id: number; name: string; color?: string; color_index?: number }> | null
  created_at?: string
  updated_at?: string
}

export type ArchivedNamedItemsResource = 'workspaces' | 'documents'

export type ArchivedNamedItemsCacheKeyInput = {
  orgSlug: string
  resource: ArchivedNamedItemsResource
  workspaceId?: string | number | null
}

function listPath(input: ArchivedNamedItemsCacheKeyInput): string {
  const slug = input.orgSlug.trim()
  if (input.resource === 'documents' && input.workspaceId != null && input.workspaceId !== '') {
    return `/orgs/${slug}/workspaces/${input.workspaceId}/documents/archived`
  }
  return `/orgs/${slug}/${input.resource}/archived`
}

function resolveQueryKey(input: ArchivedNamedItemsCacheKeyInput) {
  return queryKeys.archivedNamedItems(input.orgSlug, input.resource, input.workspaceId)
}

function upsertNamed(items: ArchivedNamedItem[], item: ArchivedNamedItem): ArchivedNamedItem[] {
  const index = items.findIndex(existing => existing.id === item.id)
  if (index >= 0) {
    const next = [...items]
    next[index] = { ...item }
    return next
  }
  return [{ ...item }, ...items]
}

function removeNamed(items: ArchivedNamedItem[], itemId: number): ArchivedNamedItem[] {
  return items.filter(item => item.id !== itemId)
}

export function upsertArchivedNamedItem(
  input: ArchivedNamedItemsCacheKeyInput,
  item: ArchivedNamedItem,
): void {
  const key = resolveQueryKey(input)
  const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key) ?? null
  const next = listWrites.record(key, cached, items => upsertNamed(items, item))
  if (next) {
    queryClient.setQueryData(key, next)
  }
  touchArchivedNamedItems()
}

export function removeArchivedNamedItem(
  input: ArchivedNamedItemsCacheKeyInput,
  itemId: number,
): void {
  const key = resolveQueryKey(input)
  const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key) ?? null
  const next = listWrites.record(key, cached, items => removeNamed(items, itemId))
  if (next) {
    queryClient.setQueryData(key, next)
  }
  touchArchivedNamedItems()
}

/** 開いている資料アーカイブ一覧すべてから外す。取得中の一覧にも削除を残す。 */
export function removeArchivedDocumentFromLists(
  orgSlug: string,
  documentId: number,
  workspaceId?: string | number | null,
): void {
  const slug = orgSlug.trim()
  const seen = new Set<string>()
  const queries = queryClient.getQueriesData<ArchivedNamedItem[]>({
    queryKey: ['archivedNamedItems', 'documents', slug],
  })
  for (const [queryKey, data] of queries) {
    seen.add(JSON.stringify(queryKey))
    const cached = Array.isArray(data) ? data : null
    const next = listWrites.record(queryKey, cached, items => removeNamed(items, documentId))
    if (next) {
      queryClient.setQueryData(queryKey, next)
    }
  }
  const explicit: ArchivedNamedItemsCacheKeyInput[] = [
    { orgSlug: slug, resource: 'documents' },
  ]
  if (workspaceId != null && workspaceId !== '') {
    explicit.push({ orgSlug: slug, resource: 'documents', workspaceId })
  }
  for (const input of explicit) {
    const key = resolveQueryKey(input)
    if (seen.has(JSON.stringify(key))) {
      continue
    }
    const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key) ?? null
    const next = listWrites.record(key, cached, items => removeNamed(items, documentId))
    if (next) {
      queryClient.setQueryData(key, next)
    }
  }
  touchArchivedNamedItems()
}

export function clearAllArchivedNamedItemsCaches(): void {
  listWrites.clear()
  queryClient.removeQueries({ queryKey: ['archivedNamedItems'] })
  touchArchivedNamedItems()
}

export function useArchivedNamedItemsCache() {
  const { api } = useApi()

  function getCached(input: ArchivedNamedItemsCacheKeyInput): ArchivedNamedItem[] | null {
    return queryClient.getQueryData(resolveQueryKey(input)) ?? null
  }

  function setCached(input: ArchivedNamedItemsCacheKeyInput, items: ArchivedNamedItem[]): void {
    queryClient.setQueryData(resolveQueryKey(input), items.map(item => ({ ...item })))
    touchArchivedNamedItems()
  }

  function invalidateCached(input: ArchivedNamedItemsCacheKeyInput): void {
    queryClient.removeQueries({ queryKey: resolveQueryKey(input), exact: true })
  }

  function invalidateArchivedWorkspaces(orgSlug: string): void {
    invalidateCached({ orgSlug, resource: 'workspaces' })
  }

  function removeCachedItem(input: ArchivedNamedItemsCacheKeyInput, itemId: number): void {
    removeArchivedNamedItem(input, itemId)
  }

  function upsertCachedItem(input: ArchivedNamedItemsCacheKeyInput, item: ArchivedNamedItem): void {
    upsertArchivedNamedItem(input, item)
  }

  async function fetchList(
    input: ArchivedNamedItemsCacheKeyInput,
    opts?: { refresh?: boolean },
  ): Promise<ArchivedNamedItem[]> {
    const key = resolveQueryKey(input)
    if (!opts?.refresh) {
      const cached = queryClient.getQueryData<ArchivedNamedItem[]>(key)
      if (cached) {
        return cached.map(item => ({ ...item }))
      }
    }

    const startedAt = listWrites.seen(key)
    const items = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const response = await api<{ data: ArchivedNamedItem[] }>(listPath(input))
        const serverItems = response.data.map(item => ({ ...item }))
        const cachedNow = queryClient.getQueryData<ArchivedNamedItem[]>(key) ?? null
        return listWrites.settle(key, startedAt, serverItems, cachedNow).items
      },
      staleTime: 0,
    })
    touchArchivedNamedItems()
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
