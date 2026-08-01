import type { WorkspaceListOption } from './useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from './useTaskFormHelpers'
import type { WbsTask } from './useWbsTaskGroups'
import { useApi } from './useApi'
import { resolveLabelColors, resolveListColors } from '../utils/colorPresetResolution'
export type WorkspaceWbsPageSnapshot = {
  tasks: WbsTask[]
  orgLabels: TaskFormLabel[]
  workspaceMembers: TaskFormMember[]
  workspaceLists: WorkspaceListOption[]
}
function cacheKey (orgSlug: string, workspaceId: string): string {
  return `${orgSlug.trim()}:${workspaceId.trim()}`
}
const cacheByKey = new Map<string, WorkspaceWbsPageSnapshot>()
const inflightByKey = new Map<string, Promise<WorkspaceWbsPageSnapshot>>()

export function clearAllWorkspaceWbsPageCaches (): void {
  cacheByKey.clear()
  inflightByKey.clear()
}

export function useWorkspaceWbsPageData () {
  const { api } = useApi()
  async function fetchSnapshot (
    orgSlug: string,
    workspaceId: string,
  ): Promise<WorkspaceWbsPageSnapshot> {
    const slug = orgSlug.trim()
    const id = workspaceId.trim()
    const key = cacheKey(slug, id)
    const inflight = inflightByKey.get(key)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const [tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
        api<{ data: WbsTask[] }>(
          `/orgs/${slug}/workspaces/${id}/tasks/wbs`,
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
      const snapshot: WorkspaceWbsPageSnapshot = {
        tasks: (tasksRes.data ?? []).map(task => ({
          ...task,
          labels: task.labels ? resolveLabelColors(task.labels) : task.labels,
        })),
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
  function warmWbsPageCache (
    orgSlug: string,
    workspaceId: string,
  ): Promise<WorkspaceWbsPageSnapshot | undefined> {
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
  function getCached (orgSlug: string, workspaceId: string): WorkspaceWbsPageSnapshot | null {
    return cacheByKey.get(cacheKey(orgSlug, workspaceId)) ?? null
  }
  function setCached (
    orgSlug: string,
    workspaceId: string,
    snapshot: WorkspaceWbsPageSnapshot,
  ): void {
    cacheByKey.set(cacheKey(orgSlug, workspaceId), {
      tasks: snapshot.tasks.map(task => ({ ...task })),
      orgLabels: snapshot.orgLabels.map(label => ({ ...label })),
      workspaceMembers: snapshot.workspaceMembers.map(member => ({ ...member })),
      workspaceLists: snapshot.workspaceLists.map(list => ({ ...list })),
    })
  }
  function invalidateCached (orgSlug: string, workspaceId: string): void {
    cacheByKey.delete(cacheKey(orgSlug, workspaceId))
  }
  function clearAllCached (): void {
    clearAllWorkspaceWbsPageCaches()
  }
  return {
    fetchSnapshot,
    warmWbsPageCache,
    getCached,
    setCached,
    invalidateCached,
    clearAllCached,
  }
}
