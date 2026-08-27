import { useApi } from './useApi'
import {
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceItem,
  type OrgWorkspaceLabel,
  type OrgWorkspaceStatus,
} from './useOrgWorkspaceIndexPageData'
import { resolveLabelColors, resolveStandardColors } from '../utils/colorPresetResolution'
import type { LabelCategoryGroup } from './useLabelCategories'
import { sortMembersByDisplayName } from './useMemberDisplay'

export type WorkspaceDetailMeta = {
  workspace: OrgWorkspaceItem
  orgLabels: OrgWorkspaceLabel[]
  orgLabelCategories: LabelCategoryGroup[]
  workspaceStatuses: OrgWorkspaceStatus[]
}

type SharedEntry = {
  workspace: OrgWorkspaceItem | null
  orgLabels: OrgWorkspaceLabel[]
  orgLabelCategories: LabelCategoryGroup[]
  workspaceStatuses: OrgWorkspaceStatus[]
  loaded: boolean
  detailFetched: boolean
}

const sharedByKey = reactive<Record<string, SharedEntry>>({})
const inflightByKey = new Map<string, Promise<WorkspaceDetailMeta>>()

export function clearAllWorkspaceDetailMetaCaches (): void {
  for (const key of Object.keys(sharedByKey)) {
    delete sharedByKey[key]
  }
  inflightByKey.clear()
}

/** 自分のプロフィール更新を、保持中のワークスペース担当者表示へ反映する */
export function patchAllWorkspaceDetailMetaUserProfiles (detail: {
  id: number
  name?: string
  avatar_url?: string | null
}): void {
  for (const entry of Object.values(sharedByKey)) {
    const workspace = entry.workspace
    if (!workspace?.assignees?.length) {
      continue
    }
    let changed = false
    const assignees = workspace.assignees.map((member) => {
      if (member.id !== detail.id) {
        return member
      }
      changed = true
      return {
        ...member,
        ...('avatar_url' in detail ? { avatar_url: detail.avatar_url ?? null } : {}),
        ...(detail.name !== undefined ? { name: detail.name } : {}),
      }
    })
    if (!changed) {
      continue
    }
    const nextAssignees = detail.name !== undefined
      ? sortMembersByDisplayName(assignees)
      : assignees
    entry.workspace = normalizeWorkspace({ ...workspace, assignees: nextAssignees })
  }
}

export function invalidateWorkspaceDetailMeta (
  orgSlug: string,
  workspaceId: string | number,
): void {
  const key = cacheKey(orgSlug, workspaceId)
  delete sharedByKey[key]
  inflightByKey.delete(key)
}

function cacheKey (orgSlug: string, workspaceId: string | number): string {
  return `${orgSlug.trim()}:${String(workspaceId).trim()}`
}

function ensureEntry (key: string): SharedEntry {
  if (!sharedByKey[key]) {
    sharedByKey[key] = {
      workspace: null,
      orgLabels: [],
      orgLabelCategories: [],
      workspaceStatuses: [],
      loaded: false,
      detailFetched: false,
    }
  }
  return sharedByKey[key]
}

function normalizeWorkspace (workspace: OrgWorkspaceItem): OrgWorkspaceItem {
  return {
    ...workspace,
    labels: workspace.labels ? resolveLabelColors(workspace.labels) : workspace.labels,
    status: workspace.status
      ? resolveStandardColors([workspace.status])[0] ?? workspace.status
      : workspace.status,
    related_workspaces: workspace.related_workspaces ?? [],
    related_documents: workspace.related_documents ?? [],
  }
}

function patchWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  mutate: (workspace: OrgWorkspaceItem) => OrgWorkspaceItem,
): void {
  const k = cacheKey(orgSlug, workspaceId)
  const entry = sharedByKey[k]
  if (!entry?.workspace) {
    return
  }
  entry.workspace = normalizeWorkspace(mutate(entry.workspace))
  entry.loaded = true
}

export function removeRelatedDocumentFromWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  documentId: number,
): void {
  patchWorkspaceDetailCache(orgSlug, workspaceId, (workspace) => ({
    ...workspace,
    related_documents: (workspace.related_documents ?? []).filter(item => item.id !== documentId),
  }))
}

export function addRelatedDocumentToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  document: { id: number; name: string; description?: string | null },
): void {
  patchWorkspaceDetailCache(orgSlug, workspaceId, (workspace) => {
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
  patchWorkspaceDetailCache(orgSlug, workspaceId, (workspace) => ({
    ...workspace,
    related_workspaces: (workspace.related_workspaces ?? []).filter(item => item.id !== relatedWorkspaceId),
  }))
}

export function addRelatedWorkspaceToWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
  relatedWorkspace: { id: number; name: string; description?: string | null },
): void {
  patchWorkspaceDetailCache(orgSlug, workspaceId, (workspace) => {
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

function hydrateFromIndexCache (
  slug: string,
  id: string,
  getCached: ReturnType<typeof useOrgWorkspaceIndexPageData>['getCached'],
  getWorkspaceFromListCache: ReturnType<typeof useOrgWorkspaceIndexPageData>['getWorkspaceFromListCache'],
): boolean {
  const k = cacheKey(slug, id)
  const entry = ensureEntry(k)
  if (entry.loaded && entry.workspace) {
    return true
  }

  const listItem = getWorkspaceFromListCache(slug, id)
  const indexCached = getCached(slug)
  if (!listItem || !indexCached) {
    return false
  }

  entry.workspace = normalizeWorkspace(listItem)
  entry.orgLabels = resolveLabelColors(indexCached.orgLabels)
  entry.orgLabelCategories = indexCached.orgLabelCategories ?? []
  entry.workspaceStatuses = resolveStandardColors(indexCached.workspaceStatuses)
  entry.loaded = true
  return true
}

export function prefetchWorkspaceDetail (
  orgSlug: string,
  workspaceId: string | number,
): Promise<WorkspaceDetailMeta> {
  const { api } = useApi()
  const { getCached, fetchSnapshot, getWorkspaceFromListCache } = useOrgWorkspaceIndexPageData()
  return fetchWorkspaceDetailMeta(
    orgSlug,
    workspaceId,
    api,
    getCached,
    fetchSnapshot,
    getWorkspaceFromListCache,
  )
}

export function warmWorkspaceDetailCache (
  orgSlug: string,
  workspaceId: string | number,
): void {
  const slug = orgSlug.trim()
  const id = String(workspaceId).trim()
  const k = cacheKey(slug, id)
  const { getCached, getWorkspaceFromListCache } = useOrgWorkspaceIndexPageData()
  hydrateFromIndexCache(slug, id, getCached, getWorkspaceFromListCache)
  const entry = sharedByKey[k]
  if (entry?.detailFetched && entry.workspace) {
    return
  }
  // 削除済み等で失敗しても warm 用途なので握りつぶす（呼び出し側の gate が正式に扱う）
  void prefetchWorkspaceDetail(slug, id).catch(() => {})
}

async function fetchWorkspaceDetailMeta (
  orgSlug: string,
  workspaceId: string | number,
  api: ReturnType<typeof useApi>['api'],
  getCached: ReturnType<typeof useOrgWorkspaceIndexPageData>['getCached'],
  fetchSnapshot: ReturnType<typeof useOrgWorkspaceIndexPageData>['fetchSnapshot'],
  getWorkspaceFromListCache: ReturnType<typeof useOrgWorkspaceIndexPageData>['getWorkspaceFromListCache'],
  force = false,
): Promise<WorkspaceDetailMeta> {
  const slug = orgSlug.trim()
  const id = String(workspaceId).trim()
  const k = cacheKey(slug, id)

  hydrateFromIndexCache(slug, id, getCached, getWorkspaceFromListCache)

  const existing = sharedByKey[k]
  if (!force && existing?.detailFetched && existing.workspace) {
    return {
      workspace: existing.workspace,
      orgLabels: existing.orgLabels,
      orgLabelCategories: existing.orgLabelCategories,
      workspaceStatuses: existing.workspaceStatuses,
    }
  }

  const inflight = inflightByKey.get(k)
  if (inflight) {
    return inflight
  }

  const job = (async () => {
    const indexCached = getCached(slug)
    const [workspaceRes, indexSnapshot] = await Promise.all([
      api<OrgWorkspaceItem>(`/orgs/${slug}/workspaces/${id}`),
      indexCached
        ? Promise.resolve(indexCached)
        : fetchSnapshot(slug).catch(() => null),
    ])

    const meta: WorkspaceDetailMeta = {
      workspace: normalizeWorkspace(workspaceRes),
      orgLabels: indexSnapshot?.orgLabels ?? existing?.orgLabels ?? [],
      orgLabelCategories: indexSnapshot?.orgLabelCategories ?? existing?.orgLabelCategories ?? [],
      workspaceStatuses: indexSnapshot?.workspaceStatuses ?? existing?.workspaceStatuses ?? [],
    }
    const target = ensureEntry(k)
    target.workspace = meta.workspace
    target.orgLabels = resolveLabelColors(meta.orgLabels)
    target.orgLabelCategories = meta.orgLabelCategories
    target.workspaceStatuses = resolveStandardColors(meta.workspaceStatuses)
    target.loaded = true
    target.detailFetched = true
    return meta
  })()

  inflightByKey.set(k, job)
  try {
    return await job
  } finally {
    if (inflightByKey.get(k) === job) {
      inflightByKey.delete(k)
    }
  }
}

export function useWorkspaceDetailMeta (
  orgSlug: MaybeRefOrGetter<string>,
  workspaceId: MaybeRefOrGetter<string | number>,
) {
  const { api } = useApi()
  const {
    getCached,
    fetchSnapshot,
    invalidateCached,
    upsertCachedWorkspace,
    getWorkspaceFromListCache,
  } = useOrgWorkspaceIndexPageData()

  const key = computed(() => cacheKey(toValue(orgSlug), toValue(workspaceId)))
  const entry = computed(() => ensureEntry(key.value))

  const workspace = computed(() => entry.value.workspace)
  const orgLabels = computed(() => entry.value.orgLabels)
  const orgLabelCategories = computed(() => entry.value.orgLabelCategories ?? [])
  const workspaceStatuses = computed(() => entry.value.workspaceStatuses)
  const loaded = computed(() => entry.value.loaded)
  const detailFetched = computed(() => entry.value.detailFetched)

  function applyMeta (meta: WorkspaceDetailMeta, targetKey = key.value) {
    const target = ensureEntry(targetKey)
    target.workspace = normalizeWorkspace(meta.workspace)
    target.orgLabels = resolveLabelColors(meta.orgLabels)
    target.orgLabelCategories = meta.orgLabelCategories ?? []
    target.workspaceStatuses = resolveStandardColors(meta.workspaceStatuses)
    target.loaded = true
    target.detailFetched = true
  }

  function applyWorkspace (value: OrgWorkspaceItem) {
    const target = ensureEntry(key.value)
    const normalized = normalizeWorkspace(value)
    target.workspace = normalized
    target.loaded = true
    target.detailFetched = true
    upsertCachedWorkspace(toValue(orgSlug), normalized)
  }

  function hydrateFromCaches () {
    const slug = toValue(orgSlug).trim()
    const id = String(toValue(workspaceId)).trim()
    if (!slug || !id) {
      return
    }
    hydrateFromIndexCache(slug, id, getCached, getWorkspaceFromListCache)
  }

  async function fetchMeta (force = false): Promise<WorkspaceDetailMeta> {
    return fetchWorkspaceDetailMeta(
      toValue(orgSlug),
      toValue(workspaceId),
      api,
      getCached,
      fetchSnapshot,
      getWorkspaceFromListCache,
      force,
    )
  }

  async function ensureLoaded (): Promise<void> {
    hydrateFromCaches()
    const existing = sharedByKey[key.value]
    if (existing?.detailFetched && existing.workspace) {
      return
    }
    await fetchMeta()
  }

  function invalidate (): void {
    const slug = toValue(orgSlug).trim()
    delete sharedByKey[key.value]
    invalidateCached(slug)
  }

  watch(
    key,
    () => {
      hydrateFromCaches()
      const existing = sharedByKey[key.value]
      if (!existing?.detailFetched) {
        void fetchMeta()
      }
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
    hydrateFromCaches,
  }
}
