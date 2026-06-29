import type { WorkspaceListOption } from './useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from './useTaskFormHelpers'
import { ORPHAN_PARENT_DEFAULT_LABEL, type TableTask } from './useTableTaskGroups'
import { useApi } from './useApi'
import { useOrgEffortUnit } from './useOrgEffortSettings'
import { resolveLabelColors, resolveListColors } from '../utils/colorPresetResolution'
export type WorkspaceTablePageSnapshot = {
  tasks: TableTask[]
  orphanParentLabel: string
  orphanParentSortOrder: number | null
  orgLabels: TaskFormLabel[]
  workspaceMembers: TaskFormMember[]
  workspaceLists: WorkspaceListOption[]
}
function cacheKey (orgSlug: string, workspaceId: string): string {
  return `${orgSlug.trim()}:${workspaceId.trim()}`
}
const cacheByKey = new Map<string, WorkspaceTablePageSnapshot>()
const inflightByKey = new Map<string, Promise<WorkspaceTablePageSnapshot>>()
export function useWorkspaceTablePageData () {
  const { api } = useApi()
  const { ensureOrgEffortUnit } = useOrgEffortUnit()
  async function fetchSnapshot (
    orgSlug: string,
    workspaceId: string,
  ): Promise<WorkspaceTablePageSnapshot> {
    const slug = orgSlug.trim()
    const id = workspaceId.trim()
    const key = cacheKey(slug, id)
    const inflight = inflightByKey.get(key)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const [, tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
        ensureOrgEffortUnit(slug),
        api<{ data: TableTask[]; meta?: { orphan_parent_label?: string; orphan_parent_sort_order?: number | null } }>(
          `/orgs/${slug}/workspaces/${id}/tasks/table`,
        ),
        api<{ data: TaskFormLabel[] }>(
          `/orgs/${slug}/task-labels`,
        ),
        api<{ data: TaskFormMember[] }>(
          `/orgs/${slug}/workspaces/${id}/members`,
        ),
        api<{ data: WorkspaceListOption[] }>(
          `/orgs/${slug}/workspaces/${id}/lists`,
        ),
      ])
      const snapshot: WorkspaceTablePageSnapshot = {
        tasks: (tasksRes.data ?? []).map(task => ({
          ...task,
          labels: task.labels ? resolveLabelColors(task.labels) : task.labels,
        })),
        orphanParentLabel: tasksRes.meta?.orphan_parent_label?.trim()
          || ORPHAN_PARENT_DEFAULT_LABEL,
        orphanParentSortOrder: tasksRes.meta?.orphan_parent_sort_order ?? null,
        orgLabels: resolveLabelColors(labelsRes.data ?? []),
        workspaceMembers: membersRes.data ?? [],
        workspaceLists: resolveListColors([...(listsRes.data ?? [])]).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      }
      setCached(slug, id, snapshot)
      return snapshot
    })()
    inflightByKey.set(key, job)
    try {
      return await job
    } finally {
      if (inflightByKey.get(key) === job) {
        inflightByKey.delete(key)
      }
    }
  }
  function warmTablePageCache (
    orgSlug: string,
    workspaceId: string,
  ): Promise<WorkspaceTablePageSnapshot | undefined> {
    const slug = orgSlug.trim()
    const id = workspaceId.trim()
    if (!slug || !id) {
      return Promise.resolve(undefined)
    }
    if (getCached(slug, id)) {
      return Promise.resolve(getCached(slug, id)!)
    }
    return fetchSnapshot(slug, id).catch(() => undefined)
  }
  function getCached (orgSlug: string, workspaceId: string): WorkspaceTablePageSnapshot | null {
    return cacheByKey.get(cacheKey(orgSlug, workspaceId)) ?? null
  }
  function setCached (
    orgSlug: string,
    workspaceId: string,
    snapshot: WorkspaceTablePageSnapshot,
  ): void {
    cacheByKey.set(cacheKey(orgSlug, workspaceId), {
      tasks: snapshot.tasks.map(task => ({ ...task })),
      orphanParentLabel: snapshot.orphanParentLabel,
      orphanParentSortOrder: snapshot.orphanParentSortOrder,
      orgLabels: snapshot.orgLabels.map(label => ({ ...label })),
      workspaceMembers: snapshot.workspaceMembers.map(member => ({ ...member })),
      workspaceLists: snapshot.workspaceLists.map(list => ({ ...list })),
    })
  }
  function invalidateCached (orgSlug: string, workspaceId: string): void {
    cacheByKey.delete(cacheKey(orgSlug, workspaceId))
  }
  return {
    fetchSnapshot,
    warmTablePageCache,
    getCached,
    setCached,
    invalidateCached,
  }
}
