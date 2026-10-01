import type { TaskFormMember } from '../task/useTaskFormHelpers'
import { sortMembersByDisplayName } from './useMemberDisplay'
import {
  getOrgWorkspaceIndexCacheMap,
  notifyOrgWorkspaceIndexCacheChanged,
} from '../workspace/useOrgWorkspaceIndexPageData'
import { getWorkspaceBoardCacheMap } from '../workspace/useWorkspaceBoardPageData'
import { getWorkspaceWbsCacheMap } from '../wbs/useWorkspaceWbsPageData'

export const WORKSPACE_MEMBERS_UPDATED_EVENT = 'tm:workspace-members-updated'
const BROADCAST_CHANNEL_NAME = WORKSPACE_MEMBERS_UPDATED_EVENT

export type WorkspaceMembersUpdatedDetail = {
  orgSlug: string
  workspaceId: string | number
  members: TaskFormMember[]
  removedMemberIds: number[]
}

let broadcastChannel: BroadcastChannel | null = null

function getBroadcastChannel (): BroadcastChannel | null {
  if (!import.meta.client || typeof BroadcastChannel === 'undefined') {
    return null
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  }
  return broadcastChannel
}

function workspaceViewCacheKey (
  orgSlug: string,
  workspaceId: string | number,
): string {
  return `${orgSlug.trim()}:${String(workspaceId).trim()}`
}

export function workspaceMembersUpdateMatchesView (
  detail: WorkspaceMembersUpdatedDetail,
  orgSlug: string,
  workspaceId: string | number,
): boolean {
  return workspaceViewCacheKey(detail.orgSlug, detail.workspaceId)
    === workspaceViewCacheKey(orgSlug, workspaceId)
}

function normalizeDetail (detail: WorkspaceMembersUpdatedDetail): WorkspaceMembersUpdatedDetail {
  return {
    orgSlug: detail.orgSlug.trim(),
    workspaceId: detail.workspaceId,
    members: sortMembersByDisplayName(detail.members.map(member => ({ ...member }))),
    removedMemberIds: [...detail.removedMemberIds],
  }
}

type TaskWithAssignees = { assignees?: TaskFormMember[] }

export function removeMembersFromTaskAssignees<T extends TaskWithAssignees> (
  tasks: T[],
  removedMemberIds: number[],
): T[] {
  if (removedMemberIds.length === 0) {
    return tasks
  }
  const removed = new Set(removedMemberIds)
  let changed = false
  const next = tasks.map((task) => {
    if (!task.assignees?.some(assignee => removed.has(assignee.id))) {
      return task
    }
    changed = true
    return {
      ...task,
      assignees: task.assignees.filter(assignee => !removed.has(assignee.id)),
    }
  })
  return changed ? next : tasks
}

function patchOrgWorkspaceMemberCaches (detail: WorkspaceMembersUpdatedDetail): void {
  const slug = detail.orgSlug
  const workspaceId = Number(detail.workspaceId)
  const cacheBySlug = getOrgWorkspaceIndexCacheMap()
  const cached = cacheBySlug.get(slug)
  if (!cached) {
    return
  }
  const index = cached.workspaces.findIndex(workspace => workspace.id === workspaceId)
  if (index < 0) {
    return
  }
  const nextWorkspaces = [...cached.workspaces]
  nextWorkspaces[index] = {
    ...nextWorkspaces[index]!,
    assignees: detail.members,
  }
  cacheBySlug.set(slug, {
    ...cached,
    workspaces: nextWorkspaces,
  })
  notifyOrgWorkspaceIndexCacheChanged()
}

function patchWorkspaceBoardMemberCaches (detail: WorkspaceMembersUpdatedDetail): void {
  const key = workspaceViewCacheKey(detail.orgSlug, detail.workspaceId)
  const cacheByKey = getWorkspaceBoardCacheMap()
  const snapshot = cacheByKey.get(key)
  if (!snapshot) {
    return
  }
  const tasks = removeMembersFromTaskAssignees(snapshot.tasks, detail.removedMemberIds)
  cacheByKey.set(key, {
    ...snapshot,
    workspaceMembers: detail.members.map(member => ({ ...member })),
    tasks,
  })
}

function patchWorkspaceWbsMemberCaches (detail: WorkspaceMembersUpdatedDetail): void {
  const key = workspaceViewCacheKey(detail.orgSlug, detail.workspaceId)
  const cacheByKey = getWorkspaceWbsCacheMap()
  const snapshot = cacheByKey.get(key)
  if (!snapshot) {
    return
  }
  const tasks = removeMembersFromTaskAssignees(snapshot.tasks, detail.removedMemberIds)
  cacheByKey.set(key, {
    ...snapshot,
    workspaceMembers: detail.members.map(member => ({ ...member })),
    tasks,
  })
}

export function patchWorkspaceMembersInPageCaches (detail: WorkspaceMembersUpdatedDetail): void {
  patchOrgWorkspaceMemberCaches(detail)
  patchWorkspaceBoardMemberCaches(detail)
  patchWorkspaceWbsMemberCaches(detail)
}

/** 表示順に揃えてから、スペース一覧・ボード・WBS のキャッシュへ書く。 */
export function applyWorkspaceMembersUpdate (detail: WorkspaceMembersUpdatedDetail): void {
  patchWorkspaceMembersInPageCaches(normalizeDetail(detail))
}

export function dispatchWorkspaceMembersUpdated (detail: WorkspaceMembersUpdatedDetail): void {
  applyWorkspaceMembersUpdate(detail)
  if (!import.meta.client) {
    return
  }
  window.dispatchEvent(new CustomEvent(WORKSPACE_MEMBERS_UPDATED_EVENT, { detail }))
  try {
    getBroadcastChannel()?.postMessage(detail)
  } catch {
    // BroadcastChannel 非対応環境では同一タブの window イベントのみ
  }
}

export function useOnWorkspaceMembersUpdated (
  handler: (detail: WorkspaceMembersUpdatedDetail) => void,
): void {
  function handleDetail (detail: WorkspaceMembersUpdatedDetail | undefined | null) {
    if (!detail?.orgSlug || detail.workspaceId === '' || detail.workspaceId == null) {
      return
    }
    handler(detail)
  }

  function onWindowEvent (event: Event) {
    handleDetail((event as CustomEvent<WorkspaceMembersUpdatedDetail>).detail)
  }

  function onBroadcastEvent (event: MessageEvent<WorkspaceMembersUpdatedDetail>) {
    const detail = event.data
    applyWorkspaceMembersUpdate(detail)
    handleDetail(detail)
  }

  onMounted(() => {
    if (!import.meta.client) {
      return
    }
    window.addEventListener(WORKSPACE_MEMBERS_UPDATED_EVENT, onWindowEvent as EventListener)
    getBroadcastChannel()?.addEventListener('message', onBroadcastEvent)
  })
  onBeforeUnmount(() => {
    if (!import.meta.client) {
      return
    }
    window.removeEventListener(WORKSPACE_MEMBERS_UPDATED_EVENT, onWindowEvent as EventListener)
    getBroadcastChannel()?.removeEventListener('message', onBroadcastEvent)
  })
}
