import { queryClient } from '../../lib/queryClient'

import { QueryCacheMapAdapter } from '../../lib/queryCacheMapAdapter'

import { queryKeys } from '../../lib/queryKeys'

import { useApi } from '../shared/useApi'

import { resolveStandardColors } from '../../utils/shared/colorPresetResolution'

import {

  normalizeDefaultWorkspaceStatusItems,
  type OrgSettingsResponse,
} from '../../components/settings/types'

import { useOrgSettingsResource } from '../settings/useOrgSettingsResource'

import type { TaskFormMember } from '../task/useTaskFormHelpers'

import {

  flattenLabelCategories,
  normalizeLabelCategories,
  resolveAndSortLabels,
  type LabelCategoryGroup,
} from '../label/useLabelCategories'

import { sortMembersByDisplayName } from '../member/useMemberDisplay'

export type OrgWorkspaceLabel = {

  id: number
  name: string
  color: string
  color_index?: number
}

export type OrgWorkspaceAssignee = TaskFormMember

export type OrgWorkspaceStatus = {

  name: string
  color_index: number
  color: string
}

export type OrgWorkspaceDocumentCategory = {

  name: string
  color_index: number
  color?: string
}

export type OrgWorkspaceDocumentItem = {

  id: number
  name: string
  description?: string | null
  category?: OrgWorkspaceDocumentCategory | null
}

export type OrgWorkspaceItem = {

  id: number
  name: string
  description?: string | null
  status?: OrgWorkspaceStatus | null
  labels?: OrgWorkspaceLabel[]
  assignees?: OrgWorkspaceAssignee[]
  documents?: OrgWorkspaceDocumentItem[]
  archived_at?: string | null
  created_at?: string
  updated_at?: string
  pinned?: boolean
  pinned_at?: string | null
}

export type OrgWorkspaceIndexPageSnapshot = {

  workspaces: OrgWorkspaceItem[]
  orgLabels: OrgWorkspaceLabel[]
  orgLabelCategories: LabelCategoryGroup[]
  orgMembers: OrgWorkspaceAssignee[]
  workspaceStatuses: OrgWorkspaceStatus[]
}

/** キャッシュ更新を Vue の computed に伝播する */

const cacheRevision = ref(0)

const snapshotInflightBySlug = new Map<string, Promise<OrgWorkspaceIndexPageSnapshot>>()

function notifyCacheChanged (): void {
  cacheRevision.value += 1
}

/** 進行中のスペース単体取得を取り消し、古い応答が正本を上書きしないようにする。 */
export function dropInFlightWorkspaceItemQuery (
  orgSlug: string,
  workspaceId: string | number,
): { slug: string, id: string } | null {
  const slug = orgSlug.trim()
  const id = String(workspaceId).trim()
  if (!slug || !id) {
    return null
  }
  const itemKey = queryKeys.orgWorkspaceItem(slug, id)
  void queryClient.cancelQueries({ queryKey: itemKey })
  queryClient.removeQueries({ queryKey: itemKey, exact: true })
  return { slug, id }
}

function workspaceUpdatedAtMs (workspace: OrgWorkspaceItem): number {
  return Date.parse(String(workspace.updated_at ?? ''))
}

/** ローカルで資料追加した直後など、古い GET が新しい楽観的更新を消さないようにする */
function isWorkspaceCacheNewer (current: OrgWorkspaceItem, incoming: OrgWorkspaceItem): boolean {
  const currentMs = workspaceUpdatedAtMs(current)
  const incomingMs = workspaceUpdatedAtMs(incoming)
  return Number.isFinite(currentMs) && Number.isFinite(incomingMs) && currentMs > incomingMs
}

function mergeIncomingWorkspaces (
  existing: OrgWorkspaceItem[] | undefined,
  incoming: OrgWorkspaceItem[],
): OrgWorkspaceItem[] {
  if (!existing?.length) {
    return incoming
  }
  const byId = new Map(existing.map(workspace => [workspace.id, workspace]))
  return incoming.map((workspace) => {
    const prev = byId.get(workspace.id)
    if (prev && isWorkspaceCacheNewer(prev, workspace)) {
      return prev
    }
    return workspace
  })
}

let orgWorkspaceIndexCacheMapAdapter: QueryCacheMapAdapter<OrgWorkspaceIndexPageSnapshot> | null = null

export function useOrgWorkspaceIndexCacheRevision (): Ref<number> {

  return cacheRevision
}

export function clearAllOrgWorkspaceIndexPageCaches (): void {

  snapshotInflightBySlug.clear()
  queryClient.removeQueries({ queryKey: ['orgWorkspaceIndex'] })
  queryClient.removeQueries({ queryKey: ['orgWorkspaceItem'] })
  notifyCacheChanged()
}

export function getOrgWorkspaceIndexCacheMap (): Map<string, OrgWorkspaceIndexPageSnapshot> {

  if (!orgWorkspaceIndexCacheMapAdapter) {
    orgWorkspaceIndexCacheMapAdapter = new QueryCacheMapAdapter(
      'orgWorkspaceIndex',
      1,
      slug => queryKeys.orgWorkspaceIndex(slug),
    )
  }

  return orgWorkspaceIndexCacheMapAdapter as Map<string, OrgWorkspaceIndexPageSnapshot>
}

/** モジュール外から正本更新を Vue に伝播する（プロフィール更新など） */

export function notifyOrgWorkspaceIndexCacheChanged (): void {

  notifyCacheChanged()
}

/** 取得済みのスペース一覧をキャッシュへ載せ、画面の computed へ伝える。 */
export function hydrateOrgWorkspaceIndexSnapshot (
  orgSlug: string,
  snapshot: OrgWorkspaceIndexPageSnapshot,
): void {
  queryClient.setQueryData(queryKeys.orgWorkspaceIndex(orgSlug.trim()), snapshot)
  notifyCacheChanged()
}

/** タスク担当者候補の正本（workspace.assignees）をインデックスキャッシュから取得 */

export function getCachedWorkspaceAssignees (

  orgSlug: string,
  workspaceId: string | number,
): OrgWorkspaceAssignee[] {
  const slug = orgSlug.trim()
  const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(queryKeys.orgWorkspaceIndex(slug))
  if (!cached) {
    return []
  }

  const id = Number(workspaceId)
  const workspace = cached.workspaces.find(item => item.id === id)
  if (!workspace?.assignees) {
    return []
  }

  return sortMembersByDisplayName(workspace.assignees.map(member => ({ ...member })))
}

function resolveWorkspaceStatuses (
  raw: OrgSettingsResponse['default_workspace_status_names'],
): OrgWorkspaceStatus[] {
  return resolveStandardColors(normalizeDefaultWorkspaceStatusItems(raw))
}

/** ラベル・ステータス・資料カテゴリの色を解決し、担当者を表示順に揃える。 */
export function normalizeOrgWorkspaceItem (

  workspace: OrgWorkspaceItem,
  catalogLabels: Array<{ id: number }> = [],
): OrgWorkspaceItem {
  return {
    ...workspace,
    labels: workspace.labels ? resolveAndSortLabels(workspace.labels, catalogLabels) : workspace.labels,
    status: workspace.status
      ? resolveStandardColors([workspace.status])[0] ?? workspace.status
      : workspace.status,
    documents: (workspace.documents ?? []).map(document => ({
      ...document,
      category: document.category
        ? resolveStandardColors([document.category])[0] ?? document.category
        : document.category ?? null,
    })),
    assignees: workspace.assignees
      ? sortMembersByDisplayName(workspace.assignees)
      : workspace.assignees,
  }

}

function normalizeSnapshot (snapshot: OrgWorkspaceIndexPageSnapshot): OrgWorkspaceIndexPageSnapshot {
  const orgLabels = resolveAndSortLabels(snapshot.orgLabels, snapshot.orgLabels)
  return {
    ...snapshot,
    workspaces: snapshot.workspaces.map(workspace => normalizeOrgWorkspaceItem(workspace, orgLabels)),
    orgLabels,
    orgMembers: sortMembersByDisplayName(snapshot.orgMembers),
    workspaceStatuses: resolveStandardColors(snapshot.workspaceStatuses),
  }

}

export function useOrgWorkspaceIndexPageData () {

  const { api } = useApi()
  const { fetchOrgSettings } = useOrgSettingsResource()
  async function fetchSnapshot (orgSlug: string): Promise<OrgWorkspaceIndexPageSnapshot> {
    const slug = orgSlug.trim()
    const existing = snapshotInflightBySlug.get(slug)
    if (existing) {
      return existing
    }

    const job = (async () => {
      const [workspacesRes, labelCategoriesRes, membersRes, settingsRes] = await Promise.all([
        api<{ data: OrgWorkspaceItem[] }>(`/orgs/${slug}/workspaces`),
        api<{ data: LabelCategoryGroup[] }>(`/orgs/${slug}/workspace-label-categories`),
        api<{ data: OrgWorkspaceAssignee[] }>(`/orgs/${slug}/members`),
        fetchOrgSettings(slug),
      ])
      const orgLabelCategories = normalizeLabelCategories(labelCategoriesRes.data ?? [])
      const snapshot = normalizeSnapshot({
        workspaces: workspacesRes.data ?? [],
        orgLabels: flattenLabelCategories(orgLabelCategories),
        orgLabelCategories,
        orgMembers: membersRes.data ?? [],
        workspaceStatuses: resolveWorkspaceStatuses(settingsRes.default_workspace_status_names),
      })
      const existing = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(
        queryKeys.orgWorkspaceIndex(slug),
      )
      const next: OrgWorkspaceIndexPageSnapshot = {
        ...snapshot,
        workspaces: mergeIncomingWorkspaces(existing?.workspaces, snapshot.workspaces),
      }
      queryClient.setQueryData(queryKeys.orgWorkspaceIndex(slug), next)
      notifyCacheChanged()
      return next
    })()

    snapshotInflightBySlug.set(slug, job)
    try {
      return await job
    } finally {
      if (snapshotInflightBySlug.get(slug) === job) {
        snapshotInflightBySlug.delete(slug)
      }
    }
  }

  async function prefetch (orgSlug: string): Promise<OrgWorkspaceIndexPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): OrgWorkspaceIndexPageSnapshot | null {
    const slug = orgSlug.trim()
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(queryKeys.orgWorkspaceIndex(slug))
    if (!cached) {
      return null
    }

    if (!Array.isArray(cached.workspaceStatuses)) {
      queryClient.removeQueries({ queryKey: queryKeys.orgWorkspaceIndex(slug), exact: true })
      notifyCacheChanged()
      return null
    }

    return cached
  }

  function invalidateCached (orgSlug: string): void {
    const slug = orgSlug.trim()
    queryClient.removeQueries({ queryKey: queryKeys.orgWorkspaceIndex(slug), exact: true })
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey
        return key[0] === 'orgWorkspaceItem' && key[1] === slug
      },
    })

    notifyCacheChanged()
  }

  function clearAllCached (): void {
    clearAllOrgWorkspaceIndexPageCaches()
  }

  function patchCachedWorkspace (
    orgSlug: string,
    workspaceId: number,
    mutate: (workspace: OrgWorkspaceItem) => OrgWorkspaceItem,
  ): void {
    const slug = orgSlug.trim()
    const key = queryKeys.orgWorkspaceIndex(slug)
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(key)
    if (!cached) {
      return
    }

    const id = workspaceId
    const index = cached.workspaces.findIndex(workspace => workspace.id === id)
    if (index < 0) {
      return
    }

    const nextWorkspaces = [...cached.workspaces]
    nextWorkspaces[index] = normalizeOrgWorkspaceItem(
      mutate(nextWorkspaces[index]!),
      cached.orgLabels,
    )
    queryClient.setQueryData(key, {
      ...cached,
      workspaces: nextWorkspaces,
    })

    notifyCacheChanged()
  }

  function patchCachedWorkspaceStatus (
    orgSlug: string,
    workspaceId: number,
    status: OrgWorkspaceStatus | null,
  ): void {
    patchCachedWorkspace(orgSlug, workspaceId, workspace => ({ ...workspace, status }))
  }

  function patchCachedWorkspaceAssignees (
    orgSlug: string,
    workspaceId: number,
    assignees: OrgWorkspaceAssignee[],
  ): void {
    patchCachedWorkspace(orgSlug, workspaceId, workspace => ({
      ...workspace,
      assignees: sortMembersByDisplayName(assignees),
    }))
  }

  /** ボード/WBS 操作などで一覧の更新日時順を即反映する */
  function touchCachedWorkspaceUpdatedAt (
    orgSlug: string,
    workspaceId: number,
    updatedAt?: string,
  ): void {
    const at = updatedAt ?? new Date().toISOString()
    patchCachedWorkspace(orgSlug, workspaceId, workspace => ({
      ...workspace,
      updated_at: at,
    }))
  }

  /**
   * Stale-While-Revalidate: 既存キャッシュを表示したまま裏で一覧を再取得する。
   * キャッシュが無い場合のみ await して初回取得する。
   */
  async function refreshSnapshotInBackground (orgSlug: string): Promise<void> {
    const slug = orgSlug.trim()
    if (!slug) {
      return
    }

    try {
      await fetchSnapshot(slug)
    } catch {
      // 失敗時は stale キャッシュを維持
    }

  }

  /** 単一スペースを裏で再取得して正本に反映（force） */
  function revalidateWorkspaceInBackground (
    orgSlug: string,
    workspaceId: string | number,
  ): void {
    void fetchAndUpsertWorkspace(orgSlug, workspaceId, { force: true }).catch(() => {})
  }

  function upsertCachedWorkspace (orgSlug: string, workspace: OrgWorkspaceItem): void {
    const slug = orgSlug.trim()
    const key = queryKeys.orgWorkspaceIndex(slug)
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(key)
    const normalized = normalizeOrgWorkspaceItem(workspace, cached?.orgLabels ?? [])
    if (!cached) {
      // 正本が無い状態でも更新を落とさない（作成直後の競合対策）
      queryClient.setQueryData(key, {
        workspaces: [normalized],
        orgLabels: [],
        orgLabelCategories: [],
        orgMembers: [],
        workspaceStatuses: [],
      })

      notifyCacheChanged()
      return
    }

    const exists = cached.workspaces.some(item => item.id === normalized.id)
    queryClient.setQueryData(key, {
      ...cached,
      workspaces: exists
        ? cached.workspaces.map((item) => {
            if (item.id !== normalized.id) {
              return item
            }
            if (isWorkspaceCacheNewer(item, normalized)) {
              return item
            }
            return { ...item, ...normalized }
          })
        : [normalized, ...cached.workspaces],
    })

    notifyCacheChanged()
  }

  function removeCachedWorkspace (orgSlug: string, workspaceId: number): void {
    const slug = orgSlug.trim()
    const key = queryKeys.orgWorkspaceIndex(slug)
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(key)
    if (!cached) {
      return
    }

    queryClient.setQueryData(key, {
      ...cached,
      workspaces: cached.workspaces.filter(workspace => workspace.id !== workspaceId),
    })

    notifyCacheChanged()
  }

  function getWorkspaceFromListCache (
    orgSlug: string,
    workspaceId: number | string,
  ): OrgWorkspaceItem | null {
    const cached = getCached(orgSlug)
    if (!cached) {
      return null
    }

    const id = Number(workspaceId)
    return cached.workspaces.find(workspace => workspace.id === id) ?? null
  }

  async function fetchAndUpsertWorkspace (
    orgSlug: string,
    workspaceId: string | number,
    opts?: { force?: boolean },
  ): Promise<OrgWorkspaceItem> {
    const slug = orgSlug.trim()
    const id = String(workspaceId).trim()
    if (!id || id === 'undefined' || !Number.isFinite(Number(id))) {
      throw new Error('Invalid workspace id')
    }
    if (!opts?.force) {
      const cachedItem = getWorkspaceFromListCache(slug, id)
      if (cachedItem) {
        return cachedItem
      }

    }

    const normalized = await queryClient.fetchQuery({
      queryKey: queryKeys.orgWorkspaceItem(slug, id),
      queryFn: async ({ signal }) => {
        const workspaceRes = await api<OrgWorkspaceItem>(`/orgs/${slug}/workspaces/${id}`)
        // queryFn 内で index 正本へ副作用書き込みしているため、キャンセル後の stale 反映を防ぐ
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }
        const cachedBefore = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(
          queryKeys.orgWorkspaceIndex(slug),
        )
        const item = normalizeOrgWorkspaceItem(workspaceRes, cachedBefore?.orgLabels ?? [])
        const indexCached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(
          queryKeys.orgWorkspaceIndex(slug),
        )
        if (indexCached) {
          upsertCachedWorkspace(slug, item)
        } else {
          const indexSnapshot = await fetchSnapshot(slug).catch(() => null)
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }
          if (indexSnapshot) {
            upsertCachedWorkspace(slug, item)
          }

        }

        return item
      },
      staleTime: 0,
    })

    return normalized
  }

  function warmWorkspaceCache (orgSlug: string, workspaceId: string | number): void {
    void fetchAndUpsertWorkspace(orgSlug, workspaceId).catch(() => {})
  }

  function addDocumentToWorkspaceCache (
    orgSlug: string,
    workspaceId: string | number,
    document: OrgWorkspaceDocumentItem,
  ): void {
    patchDocumentInAllCachedWorkspaces(orgSlug, document, {
      addToWorkspaceIds: [workspaceId],
    })
  }

  function removeDocumentFromWorkspaceCache (
    orgSlug: string,
    workspaceId: string | number,
    documentId: number,
  ): void {
    dropInFlightWorkspaceItemQuery(orgSlug, workspaceId)
    patchCachedWorkspace(orgSlug, Number(workspaceId), workspace => ({
      ...workspace,
      documents: (workspace.documents ?? []).filter(item => item.id !== documentId),
      updated_at: new Date().toISOString(),
    }))
  }

  function updateDocumentInWorkspaceCache (
    orgSlug: string,
    workspaceId: string | number,
    document: OrgWorkspaceDocumentItem,
  ): void {
    patchDocumentInAllCachedWorkspaces(orgSlug, document, {
      addToWorkspaceIds: [workspaceId],
    })
  }

  function patchDocumentInAllCachedWorkspaces (
    orgSlug: string,
    document: OrgWorkspaceDocumentItem,
    options?: { addToWorkspaceIds?: Array<string | number> },
  ): void {
    const slug = orgSlug.trim()
    const key = queryKeys.orgWorkspaceIndex(slug)
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(key)
    if (!cached) {
      return
    }
    const addTo = new Set(
      (options?.addToWorkspaceIds ?? [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id)),
    )
    let changed = false
    const nextWorkspaces = cached.workspaces.map((workspace) => {
      const list = workspace.documents ?? []
      const documentIndex = list.findIndex(item => item.id === document.id)
      const shouldAdd = addTo.has(workspace.id)
      if (documentIndex < 0 && !shouldAdd) {
        return workspace
      }
      changed = true
      dropInFlightWorkspaceItemQuery(slug, workspace.id)
      const nextDocuments = documentIndex >= 0
        ? list.map((item, index) => (index === documentIndex ? { ...item, ...document } : item))
        : [document, ...list]
      return normalizeOrgWorkspaceItem({
        ...workspace,
        documents: nextDocuments,
        updated_at: new Date().toISOString(),
      }, cached.orgLabels)
    })
    if (!changed) {
      return
    }
    queryClient.setQueryData(key, {
      ...cached,
      workspaces: nextWorkspaces,
    })
    notifyCacheChanged()
  }

  function removeDocumentFromAllCachedWorkspaces (
    orgSlug: string,
    documentId: number,
  ): number[] {
    const slug = orgSlug.trim()
    const key = queryKeys.orgWorkspaceIndex(slug)
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(key)
    if (!cached) {
      return []
    }
    const removedFrom: number[] = []
    const nextWorkspaces = cached.workspaces.map((workspace) => {
      const list = workspace.documents ?? []
      if (!list.some(item => item.id === documentId)) {
        return workspace
      }
      removedFrom.push(workspace.id)
      dropInFlightWorkspaceItemQuery(slug, workspace.id)
      return {
        ...workspace,
        documents: list.filter(item => item.id !== documentId),
        updated_at: new Date().toISOString(),
      }
    })
    if (removedFrom.length === 0) {
      return []
    }
    queryClient.setQueryData(key, {
      ...cached,
      workspaces: nextWorkspaces,
    })
    notifyCacheChanged()
    return removedFrom
  }

  function removeOrgMemberFromAllCachedWorkspaces (orgSlug: string, memberId: number): number[] {
    const slug = orgSlug.trim()
    const key = queryKeys.orgWorkspaceIndex(slug)
    const cached = queryClient.getQueryData<OrgWorkspaceIndexPageSnapshot>(key)
    if (!cached) {
      return []
    }
    const affectedWorkspaceIds: number[] = []
    const orgMembers = cached.orgMembers.filter(member => member.id !== memberId)
    const workspaces = cached.workspaces.map((workspace) => {
      if (!workspace.assignees?.some(member => member.id === memberId)) {
        return workspace
      }
      affectedWorkspaceIds.push(workspace.id)
      return {
        ...workspace,
        assignees: workspace.assignees.filter(member => member.id !== memberId),
        updated_at: new Date().toISOString(),
      }
    })
    const orgMembersChanged = orgMembers.length !== cached.orgMembers.length
    if (!orgMembersChanged && affectedWorkspaceIds.length === 0) {
      return []
    }
    queryClient.setQueryData(key, {
      ...cached,
      orgMembers,
      workspaces,
    })
    notifyCacheChanged()
    return affectedWorkspaceIds
  }

  /** 自分のプロフィール更新を、保持中のスペース担当者表示へ反映する */
  function patchAllCachedWorkspaceUserProfiles (detail: {
    id: number
    name?: string
    avatar_url?: string | null
  }): void {
    const cacheBySlug = getOrgWorkspaceIndexCacheMap()
    for (const [slug, snapshot] of cacheBySlug) {
      const orgMembers = snapshot.orgMembers.map((member) => {
        if (member.id !== detail.id) {
          return member
        }

        return {
          ...member,
          ...('avatar_url' in detail ? { avatar_url: detail.avatar_url ?? null } : {}),
          ...(detail.name !== undefined ? { name: detail.name } : {}),
        }

      })

      let workspacesChanged = false
      const workspaces = snapshot.workspaces.map((workspace) => {
        if (!workspace.assignees?.length) {
          return workspace
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
          return workspace
        }

        workspacesChanged = true
        const nextAssignees = detail.name !== undefined
          ? sortMembersByDisplayName(assignees)
          : assignees
        return { ...workspace, assignees: nextAssignees }
      })

      const orgMembersChanged = orgMembers.some((member, index) => member !== snapshot.orgMembers[index])
      if (!orgMembersChanged && !workspacesChanged) {
        continue
      }

      cacheBySlug.set(slug, {
        ...snapshot,
        orgMembers: detail.name !== undefined ? sortMembersByDisplayName(orgMembers) : orgMembers,
        workspaces: workspacesChanged ? workspaces : snapshot.workspaces,
      })

    }

    notifyCacheChanged()
  }

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    getWorkspaceFromListCache,
    invalidateCached,
    clearAllCached,
    patchCachedWorkspace,
    patchCachedWorkspaceStatus,
    patchCachedWorkspaceAssignees,
    touchCachedWorkspaceUpdatedAt,
    refreshSnapshotInBackground,
    revalidateWorkspaceInBackground,
    upsertCachedWorkspace,
    removeCachedWorkspace,
    fetchAndUpsertWorkspace,
    warmWorkspaceCache,
    addDocumentToWorkspaceCache,
    removeDocumentFromWorkspaceCache,
    updateDocumentInWorkspaceCache,
    patchDocumentInAllCachedWorkspaces,
    removeDocumentFromAllCachedWorkspaces,
    removeOrgMemberFromAllCachedWorkspaces,
    patchAllCachedWorkspaceUserProfiles,
  }

}

