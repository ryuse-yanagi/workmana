import { useApi } from './useApi'
import { resolveLabelColors, resolveStandardColors } from '../utils/colorPresetResolution'
import {
  DEFAULT_WORKSPACE_STATUS_ITEMS,
  normalizeDefaultWorkspaceStatusItems,
  type OrgSettingsResponse,
} from '../components/settings/types'

import type { TaskFormMember } from './useTaskFormHelpers'

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

export type OrgWorkspaceRelatedItem = {
  id: number
  name: string
  description?: string | null
}

export type OrgWorkspaceItem = {
  id: number
  name: string
  description?: string | null
  status?: OrgWorkspaceStatus | null
  labels?: OrgWorkspaceLabel[]
  assignees?: OrgWorkspaceAssignee[]
  related_workspaces?: OrgWorkspaceRelatedItem[]
  related_documents?: OrgWorkspaceRelatedItem[]
  archived_at?: string | null
}

export type OrgWorkspaceIndexPageSnapshot = {
  workspaces: OrgWorkspaceItem[]
  orgLabels: OrgWorkspaceLabel[]
  orgMembers: OrgWorkspaceAssignee[]
  workspaceStatuses: OrgWorkspaceStatus[]
}

const cacheBySlug = new Map<string, OrgWorkspaceIndexPageSnapshot>()
const inflightBySlug = new Map<string, Promise<OrgWorkspaceIndexPageSnapshot>>()

export function clearAllOrgWorkspaceIndexPageCaches (): void {
  cacheBySlug.clear()
  inflightBySlug.clear()
}

function resolveWorkspaceStatuses (
  raw: OrgSettingsResponse['default_workspace_status_names'],
): OrgWorkspaceStatus[] {
  return resolveStandardColors(normalizeDefaultWorkspaceStatusItems(raw))
}

export function useOrgWorkspaceIndexPageData () {
  const { api } = useApi()

  async function fetchSnapshot (orgSlug: string): Promise<OrgWorkspaceIndexPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const [workspacesRes, labelsRes, membersRes, settingsRes] = await Promise.all([
        api<{ data: OrgWorkspaceItem[] }>(`/orgs/${slug}/workspaces`),
        api<{ data: OrgWorkspaceLabel[] }>(`/orgs/${slug}/workspace-labels`),
        api<{ data: OrgWorkspaceAssignee[] }>(`/orgs/${slug}/members`),
        api<OrgSettingsResponse>(`/orgs/${slug}/settings`),
      ])
      const snapshot: OrgWorkspaceIndexPageSnapshot = {
        workspaces: workspacesRes.data.map(workspace => ({
          ...workspace,
          labels: workspace.labels ? resolveLabelColors(workspace.labels) : workspace.labels,
          status: workspace.status ? resolveStandardColors([workspace.status])[0] ?? workspace.status : workspace.status,
        })),
        orgLabels: resolveLabelColors(labelsRes.data),
        orgMembers: membersRes.data,
        workspaceStatuses: resolveWorkspaceStatuses(settingsRes.default_workspace_status_names),
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

  async function prefetch (orgSlug: string): Promise<OrgWorkspaceIndexPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): OrgWorkspaceIndexPageSnapshot | null {
    const cached = cacheBySlug.get(orgSlug.trim())
    if (!cached) {
      return null
    }
    // ステータス選択 UI 追加前のキャッシュは破棄して再取得する
    if (!Array.isArray(cached.workspaceStatuses)) {
      cacheBySlug.delete(orgSlug.trim())
      return null
    }
    return cached
  }

  function invalidateCached (orgSlug: string): void {
    cacheBySlug.delete(orgSlug.trim())
  }

  function clearAllCached (): void {
    clearAllOrgWorkspaceIndexPageCaches()
  }

  function patchCachedWorkspaceStatus (
    orgSlug: string,
    workspaceId: number,
    status: OrgWorkspaceStatus | null,
  ): void {
    const cached = cacheBySlug.get(orgSlug.trim())
    if (!cached) {
      return
    }
    cacheBySlug.set(orgSlug.trim(), {
      ...cached,
      workspaces: cached.workspaces.map(workspace => (
        workspace.id === workspaceId
          ? { ...workspace, status }
          : workspace
      )),
    })
  }

  function patchCachedWorkspaceAssignees (
    orgSlug: string,
    workspaceId: number,
    assignees: OrgWorkspaceAssignee[],
  ): void {
    const cached = cacheBySlug.get(orgSlug.trim())
    if (!cached) {
      return
    }
    cacheBySlug.set(orgSlug.trim(), {
      ...cached,
      workspaces: cached.workspaces.map(workspace => (
        workspace.id === workspaceId
          ? { ...workspace, assignees }
          : workspace
      )),
    })
  }

  function upsertCachedWorkspace (orgSlug: string, workspace: OrgWorkspaceItem): void {
    const cached = cacheBySlug.get(orgSlug.trim())
    if (!cached) {
      return
    }
    const normalized: OrgWorkspaceItem = {
      ...workspace,
      labels: workspace.labels ? resolveLabelColors(workspace.labels) : workspace.labels,
      status: workspace.status
        ? resolveStandardColors([workspace.status])[0] ?? workspace.status
        : workspace.status,
    }
    const exists = cached.workspaces.some(item => item.id === normalized.id)
    cacheBySlug.set(orgSlug.trim(), {
      ...cached,
      workspaces: exists
        ? cached.workspaces.map(item => (item.id === normalized.id ? { ...item, ...normalized } : item))
        : [normalized, ...cached.workspaces],
    })
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

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    getWorkspaceFromListCache,
    invalidateCached,
    clearAllCached,
    patchCachedWorkspaceStatus,
    patchCachedWorkspaceAssignees,
    upsertCachedWorkspace,
  }
}
