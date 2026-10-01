import { useApi } from '../shared/useApi'
import {
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceItem,
} from './useOrgWorkspaceIndexPageData'
import { invalidateWorkspaceViewCaches } from '../settings/invalidateOrgDerivedCaches'
import { dispatchWorkspaceMembersUpdated } from '../member/workspaceMembersUpdated'
import { useArchivedNamedItemsCache } from '../archived/useArchivedNamedItemsCache'

export type WorkspaceUpdatePayload = {
  name?: string
  description?: string | null
  status?: string | null
  label_ids?: number[]
  assignee_ids?: number[]
}

export type WorkspaceUpdateOptions = {
  /** 楽観更新後に assignee_ids を PATCH するとき、削除差分計算用 */
  previousAssigneeIds?: number[]
}

export function useWorkspaceMutations (orgSlug: MaybeRefOrGetter<string>) {
  const { api } = useApi()
  const {
    upsertCachedWorkspace,
    removeCachedWorkspace,
    patchCachedWorkspaceStatus,
    patchCachedWorkspaceAssignees,
    patchCachedWorkspace,
    fetchAndUpsertWorkspace,
    getWorkspaceFromListCache,
    invalidateCached: invalidateOrgWorkspaceIndexCached,
  } = useOrgWorkspaceIndexPageData()

  function slugValue (): string {
    return toValue(orgSlug).trim()
  }

  function invalidateWorkspaceViews (workspaceId: string | number): void {
    invalidateWorkspaceViewCaches(slugValue(), workspaceId)
  }

  /** 担当者だけの変更はボードと WBS を破棄せず、それ以外は表示キャッシュを捨てる。 */
  async function updateWorkspace (
    workspaceId: number,
    payload: WorkspaceUpdatePayload,
    options?: WorkspaceUpdateOptions,
  ): Promise<OrgWorkspaceItem> {
    const slug = slugValue()
    const previousAssigneeIds = payload.assignee_ids !== undefined
      ? (options?.previousAssigneeIds
        ?? getWorkspaceFromListCache(slug, workspaceId)?.assignees?.map(member => member.id)
        ?? [])
      : null
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${slug}/workspaces/${workspaceId}`,
      { method: 'PATCH', body: payload },
    )
    upsertCachedWorkspace(slug, updated)
    const assigneeOnlyChange = payload.assignee_ids !== undefined
      && Object.keys(payload).length === 1
    if (payload.assignee_ids !== undefined) {
      const nextAssigneeIds = new Set(payload.assignee_ids)
      dispatchWorkspaceMembersUpdated({
        orgSlug: slug,
        workspaceId,
        members: updated.assignees ?? [],
        removedMemberIds: (previousAssigneeIds ?? []).filter(id => !nextAssigneeIds.has(id)),
      })
    }
    if (!assigneeOnlyChange) {
      invalidateWorkspaceViews(workspaceId)
    }
    return updated
  }

  async function createWorkspace (payload: {
    name: string
    description?: string | null
    status?: string | null
    label_ids?: number[]
    assignee_ids?: number[]
  }): Promise<OrgWorkspaceItem> {
    const created = await api<OrgWorkspaceItem>(
      `/orgs/${slugValue()}/workspaces`,
      { method: 'POST', body: payload },
    )
    upsertCachedWorkspace(slugValue(), created)
    return created
  }

  async function archiveWorkspace (workspaceId: number): Promise<void> {
    const slug = slugValue()
    const previous = getWorkspaceFromListCache(slug, workspaceId)
    await api(`/orgs/${slug}/workspaces/${workspaceId}/archive`, {
      method: 'POST',
    })
    if (previous) {
      const { upsertCachedItem } = useArchivedNamedItemsCache()
      upsertCachedItem(
        { orgSlug: slug, resource: 'workspaces' },
        {
          id: previous.id,
          name: previous.name,
          description: previous.description ?? null,
          status: previous.status ?? null,
          labels: previous.labels ?? [],
          archived_at: new Date().toISOString(),
        },
      )
    }
    removeCachedWorkspace(slug, workspaceId)
    invalidateWorkspaceViews(workspaceId)
  }

  async function pinWorkspace (workspaceId: number): Promise<OrgWorkspaceItem> {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${slugValue()}/workspaces/${workspaceId}/pin`,
      { method: 'POST' },
    )
    upsertCachedWorkspace(slugValue(), updated)
    return updated
  }

  async function unpinWorkspace (workspaceId: number): Promise<OrgWorkspaceItem> {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${slugValue()}/workspaces/${workspaceId}/unpin`,
      { method: 'POST' },
    )
    upsertCachedWorkspace(slugValue(), updated)
    return updated
  }

  async function patchWorkspaceStatus (
    workspaceId: number,
    statusName: string,
  ): Promise<OrgWorkspaceItem> {
    return updateWorkspace(workspaceId, { status: statusName })
  }

  async function patchWorkspaceAssignees (
    workspaceId: number,
    assigneeIds: number[],
    options?: WorkspaceUpdateOptions,
  ): Promise<OrgWorkspaceItem> {
    return updateWorkspace(workspaceId, { assignee_ids: assigneeIds }, options)
  }

  return {
    updateWorkspace,
    createWorkspace,
    archiveWorkspace,
    pinWorkspace,
    unpinWorkspace,
    patchWorkspaceStatus,
    patchWorkspaceAssignees,
    fetchAndUpsertWorkspace,
    upsertCachedWorkspace,
    patchCachedWorkspaceStatus,
    patchCachedWorkspaceAssignees,
    invalidateOrgWorkspaceIndexCached,
    invalidateWorkspaceViews,
  }
}
