import { sortMembersByDisplayName, type MemberLike } from './useMemberDisplay'
import { getWorkspaceBoardCacheMap } from './useWorkspaceBoardPageData'
import { getWorkspaceWbsCacheMap } from './useWorkspaceWbsPageData'
import { getOrgWorkspaceIndexCacheMap, notifyOrgWorkspaceIndexCacheChanged } from './useOrgWorkspaceIndexPageData'

export const USER_PROFILE_UPDATED_EVENT = 'tm:user-profile-updated'

export type UserProfileUpdatedDetail = {
  id: number
  name?: string
  avatar_url?: string | null
}

/** プロフィール反映対象（表示用に name / avatar が欠けてもよい） */
type ProfileMemberLike = Pick<MemberLike, 'id'> & Partial<Pick<MemberLike, 'name' | 'avatar_url'>>

/** プロフィール更新後、古い avatar_url が残っていても表示を上書きする */
const avatarUrlOverrides = shallowRef(new Map<number, string | null>())

export function getAvatarUrlOverride (userId: number): string | null | undefined {
  return avatarUrlOverrides.value.get(userId)
}

export function setAvatarUrlOverride (userId: number, avatarUrl: string | null): void {
  const next = new Map(avatarUrlOverrides.value)
  next.set(userId, avatarUrl)
  avatarUrlOverrides.value = next
}

export function clearAvatarUrlOverrides (): void {
  if (avatarUrlOverrides.value.size === 0) {
    return
  }
  avatarUrlOverrides.value = new Map()
}

/** 表示用: オーバーライドがあればそちらを優先 */
export function resolveDisplayAvatarUrl (
  member: { id?: number | null; avatar_url?: string | null },
): string | null {
  const id = member.id
  if (id != null && avatarUrlOverrides.value.has(id)) {
    return avatarUrlOverrides.value.get(id) ?? null
  }
  return member.avatar_url ?? null
}

export function applyUserProfileToMember<T extends ProfileMemberLike> (
  member: T,
  detail: UserProfileUpdatedDetail,
): T {
  if (member.id !== detail.id) {
    return member
  }
  return {
    ...member,
    ...('avatar_url' in detail ? { avatar_url: detail.avatar_url ?? null } : {}),
    ...(detail.name !== undefined ? { name: detail.name } : {}),
  }
}

export function applyUserProfileToMembers<T extends ProfileMemberLike> (
  members: T[],
  detail: UserProfileUpdatedDetail,
): T[] {
  let changed = false
  const next = members.map((member) => {
    const patched = applyUserProfileToMember(member, detail)
    if (patched !== member) {
      changed = true
    }
    return patched
  })
  if (!changed) {
    return members
  }
  // 名前変更で並びが変わるため、表示順を即時に合わせる（詳細モーダルのシードと API 再取得のちらつき防止）
  if (detail.name !== undefined) {
    return sortMembersByDisplayName(next as Array<T & MemberLike>)
  }
  return next
}

export function applyUserProfileToTaskAssignees<T extends { assignees?: ProfileMemberLike[] }> (
  task: T,
  detail: UserProfileUpdatedDetail,
): T {
  if (!task.assignees?.length) {
    return task
  }
  const assignees = applyUserProfileToMembers(task.assignees, detail)
  if (assignees === task.assignees) {
    return task
  }
  return { ...task, assignees }
}

export function applyUserProfileToTasks<T extends { assignees?: ProfileMemberLike[] }> (
  tasks: T[],
  detail: UserProfileUpdatedDetail,
): T[] {
  let changed = false
  const next = tasks.map((task) => {
    const patched = applyUserProfileToTaskAssignees(task, detail)
    if (patched !== task) {
      changed = true
    }
    return patched
  })
  return changed ? next : tasks
}

function patchWorkspaceBoardCaches (detail: UserProfileUpdatedDetail): void {
  const cacheByKey = getWorkspaceBoardCacheMap()
  for (const [key, snapshot] of cacheByKey) {
    const tasks = applyUserProfileToTasks(snapshot.tasks, detail)
    const workspaceMembers = applyUserProfileToMembers(snapshot.workspaceMembers, detail)
    if (
      tasks === snapshot.tasks
      && workspaceMembers === snapshot.workspaceMembers
    ) {
      continue
    }
    cacheByKey.set(key, {
      ...snapshot,
      tasks,
      workspaceMembers,
    })
  }
}

function patchWorkspaceWbsCaches (detail: UserProfileUpdatedDetail): void {
  const cacheByKey = getWorkspaceWbsCacheMap()
  for (const [key, snapshot] of cacheByKey) {
    const tasks = applyUserProfileToTasks(snapshot.tasks, detail)
    const workspaceMembers = applyUserProfileToMembers(snapshot.workspaceMembers, detail)
    if (tasks === snapshot.tasks && workspaceMembers === snapshot.workspaceMembers) {
      continue
    }
    cacheByKey.set(key, {
      ...snapshot,
      tasks,
      workspaceMembers,
    })
  }
}

function patchOrgWorkspaceIndexCaches (detail: UserProfileUpdatedDetail): void {
  const cacheBySlug = getOrgWorkspaceIndexCacheMap()
  for (const [slug, snapshot] of cacheBySlug) {
    const orgMembers = applyUserProfileToMembers(snapshot.orgMembers, detail)
    let workspacesChanged = false
    const workspaces = snapshot.workspaces.map((workspace) => {
      if (!workspace.assignees?.length) {
        return workspace
      }
      const assignees = applyUserProfileToMembers(workspace.assignees, detail)
      if (assignees === workspace.assignees) {
        return workspace
      }
      workspacesChanged = true
      return { ...workspace, assignees }
    })
    if (orgMembers === snapshot.orgMembers && !workspacesChanged) {
      continue
    }
    cacheBySlug.set(slug, {
      ...snapshot,
      orgMembers,
      workspaces: workspacesChanged ? workspaces : snapshot.workspaces,
    })
  }
  notifyOrgWorkspaceIndexCacheChanged()
}

export function patchUserProfileInPageCaches (detail: UserProfileUpdatedDetail): void {
  patchWorkspaceBoardCaches(detail)
  patchWorkspaceWbsCaches(detail)
  patchOrgWorkspaceIndexCaches(detail)
}

export function dispatchUserProfileUpdated (detail: UserProfileUpdatedDetail): void {
  if (!import.meta.client || !detail.id) {
    return
  }
  if ('avatar_url' in detail) {
    setAvatarUrlOverride(detail.id, detail.avatar_url ?? null)
  }
  patchUserProfileInPageCaches(detail)
  window.dispatchEvent(new CustomEvent(USER_PROFILE_UPDATED_EVENT, { detail }))
}

export function useOnUserProfileUpdated (
  handler: (detail: UserProfileUpdatedDetail) => void,
): void {
  function onEvent (e: Event) {
    const detail = (e as CustomEvent<UserProfileUpdatedDetail>).detail
    if (!detail?.id) {
      return
    }
    handler(detail)
  }
  onMounted(() => {
    if (import.meta.client) {
      window.addEventListener(USER_PROFILE_UPDATED_EVENT, onEvent as EventListener)
    }
  })
  onBeforeUnmount(() => {
    if (import.meta.client) {
      window.removeEventListener(USER_PROFILE_UPDATED_EVENT, onEvent as EventListener)
    }
  })
}
