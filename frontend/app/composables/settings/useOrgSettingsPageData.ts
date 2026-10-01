import type {
  SettingsLabelCategory,
  SettingsLabelTabKey,
  SettingsOrgMember,
  SettingsPageSnapshot,
  SettingsPendingInvite,
} from '../../components/settings/types'
import { normalizeSettingsLabelCategories } from '../../components/settings/labelCategoryNormalize'
import { useApi } from '../shared/useApi'
import {
  clearAllOrgSettingsResourceCaches,
  getCachedOrgSettings,
  invalidateOrgSettingsResource,
  setCachedOrgSettings,
  useOrgSettingsResource,
} from './useOrgSettingsResource'

const cacheBySlug = new Map<string, SettingsPageSnapshot>()
const inflightBySlug = new Map<string, Promise<SettingsPageSnapshot>>()

export function clearAllOrgSettingsPageCaches (): void {
  cacheBySlug.clear()
  inflightBySlug.clear()
  clearAllOrgSettingsResourceCaches()
}

export function isSettingsSnapshotReady (snapshot: SettingsPageSnapshot | null | undefined): boolean {
  return Boolean(
    snapshot?.orgSettings?.role
    && Array.isArray(snapshot.members)
    && typeof snapshot.memberCount === 'number'
    && Array.isArray(snapshot.pendingInvites)
    && Array.isArray(snapshot.workspaceLabelCategories)
    && Array.isArray(snapshot.taskLabelCategories),
  )
}

export function useOrgSettingsPageData () {
  const { api } = useApi()
  const { fetchOrgSettings } = useOrgSettingsResource()

  async function fetchSnapshot (orgSlug: string, opts?: { refresh?: boolean }): Promise<SettingsPageSnapshot> {
    const slug = orgSlug.trim()
    if (opts?.refresh) {
      cacheBySlug.delete(slug)
      inflightBySlug.delete(slug)
    } else {
      const cached = cacheBySlug.get(slug)
      if (cached && isSettingsSnapshotReady(cached)) {
        return cached
      }
    }

    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const orgSettingsPromise = fetchOrgSettings(slug, opts?.refresh ? { refresh: true } : undefined)
      const workspacePromise = api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/workspace-label-categories`)
      const taskPromise = api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/task-label-categories`)
      const membersPromise = api<{ data: SettingsOrgMember[] }>(`/orgs/${slug}/members`)

      const orgSettings = await orgSettingsPromise
      const invitesPromise = orgSettings.role === 'admin'
        ? api<{ data: SettingsPendingInvite[] }>(`/orgs/${slug}/invites`)
        : Promise.resolve({ data: [] as SettingsPendingInvite[] })

      const [workspaceLabelCategoriesRes, taskLabelCategoriesRes, membersRes, invitesRes] = await Promise.all([
        workspacePromise,
        taskPromise,
        membersPromise,
        invitesPromise,
      ])

      const members = Array.isArray(membersRes.data) ? membersRes.data : []
      const snapshot: SettingsPageSnapshot = {
        orgSettings,
        workspaceLabelCategories: normalizeSettingsLabelCategories(workspaceLabelCategoriesRes.data),
        taskLabelCategories: normalizeSettingsLabelCategories(taskLabelCategoriesRes.data),
        members,
        memberCount: members.length,
        pendingInvites: Array.isArray(invitesRes.data) ? invitesRes.data : [],
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

  async function prefetch (orgSlug: string): Promise<SettingsPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): SettingsPageSnapshot | null {
    return cacheBySlug.get(orgSlug.trim()) ?? null
  }

  function getCachedLabelCategories (
    orgSlug: string,
    labelKind: SettingsLabelTabKey,
  ): SettingsLabelCategory[] | null {
    const snapshot = getCached(orgSlug)
    if (!snapshot) {
      return null
    }
    return labelKind === 'workspace'
      ? snapshot.workspaceLabelCategories
      : snapshot.taskLabelCategories
  }

  function patchLabelCategoriesCache (
    orgSlug: string,
    labelKind: SettingsLabelTabKey,
    categories: SettingsLabelCategory[],
  ): void {
    const slug = orgSlug.trim()
    const existing = cacheBySlug.get(slug)
    if (!existing) {
      return
    }
    cacheBySlug.set(slug, {
      ...existing,
      ...(labelKind === 'workspace'
        ? { workspaceLabelCategories: categories }
        : { taskLabelCategories: categories }),
    })
  }

  function patchOrgSettingsCache (
    orgSlug: string,
    orgSettings: SettingsPageSnapshot['orgSettings'],
  ): void {
    const slug = orgSlug.trim()
    const existing = cacheBySlug.get(slug)
    const previous = existing?.orgSettings ?? getCachedOrgSettings(slug)
    // 更新 API が role を欠いても、既知の権限を消さない。
    // 欠けるとメンバー一覧の再取得がこのキャッシュで画面を上書きし、管理者操作が消える。
    const merged: SettingsPageSnapshot['orgSettings'] = {
      ...previous,
      ...orgSettings,
    }
    if ((merged.role == null || merged.role === '') && previous?.role) {
      merged.role = previous.role
    }
    setCachedOrgSettings(slug, merged)
    if (!existing) {
      return
    }
    cacheBySlug.set(slug, {
      ...existing,
      orgSettings: merged,
    })
  }

  function patchMembersCache (
    orgSlug: string,
    members: SettingsOrgMember[],
    pendingInvites?: SettingsPendingInvite[],
  ): void {
    const slug = orgSlug.trim()
    const existing = cacheBySlug.get(slug)
    if (!existing) {
      return
    }
    cacheBySlug.set(slug, {
      ...existing,
      members,
      memberCount: members.length,
      pendingInvites: pendingInvites ?? existing.pendingInvites,
    })
  }

  function invalidateCached (orgSlug: string): void {
    const slug = orgSlug.trim()
    cacheBySlug.delete(slug)
    invalidateOrgSettingsResource(slug)
  }

  function clearAllCached (): void {
    clearAllOrgSettingsPageCaches()
  }

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    getCachedLabelCategories,
    patchLabelCategoriesCache,
    patchOrgSettingsCache,
    patchMembersCache,
    invalidateCached,
    clearAllCached,
  }
}
