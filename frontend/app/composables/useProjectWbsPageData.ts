import type { ProjectListOption } from './useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from './useTaskFormHelpers'
import { WBS_ORPHAN_PARENT_DEFAULT_LABEL, type WbsTask } from './useWbsTaskGroups'
import { useApi } from './useApi'
import { useOrgEffortUnit } from './useOrgEffortSettings'

export type ProjectWbsPageSnapshot = {
  tasks: WbsTask[]
  orphanParentLabel: string
  orphanParentSortOrder: number | null
  orgLabels: TaskFormLabel[]
  projectMembers: TaskFormMember[]
  projectLists: ProjectListOption[]
}

function cacheKey (orgSlug: string, projectId: string): string {
  return `${orgSlug.trim()}:${projectId.trim()}`
}

const cacheByKey = new Map<string, ProjectWbsPageSnapshot>()
const inflightByKey = new Map<string, Promise<ProjectWbsPageSnapshot>>()

export function useProjectWbsPageData () {
  const { api } = useApi()
  const { ensureOrgEffortUnit } = useOrgEffortUnit()

  async function fetchSnapshot (
    orgSlug: string,
    projectId: string,
  ): Promise<ProjectWbsPageSnapshot> {
    const slug = orgSlug.trim()
    const id = projectId.trim()
    const key = cacheKey(slug, id)
    const inflight = inflightByKey.get(key)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const [, tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
        ensureOrgEffortUnit(slug),
        api<{ data: WbsTask[]; meta?: { orphan_parent_label?: string; orphan_parent_sort_order?: number | null } }>(
          `/orgs/${slug}/projects/${id}/tasks/wbs`,
        ),
        api<{ data: TaskFormLabel[] }>(
          `/orgs/${slug}/task-labels`,
        ),
        api<{ data: TaskFormMember[] }>(
          `/orgs/${slug}/projects/${id}/members`,
        ),
        api<{ data: ProjectListOption[] }>(
          `/orgs/${slug}/projects/${id}/lists`,
        ),
      ])
      const snapshot: ProjectWbsPageSnapshot = {
        tasks: tasksRes.data ?? [],
        orphanParentLabel: tasksRes.meta?.orphan_parent_label?.trim()
          || WBS_ORPHAN_PARENT_DEFAULT_LABEL,
        orphanParentSortOrder: tasksRes.meta?.orphan_parent_sort_order ?? null,
        orgLabels: labelsRes.data ?? [],
        projectMembers: membersRes.data ?? [],
        projectLists: [...(listsRes.data ?? [])].sort(
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
    projectId: string,
  ): Promise<ProjectWbsPageSnapshot | undefined> {
    const slug = orgSlug.trim()
    const id = projectId.trim()
    if (!slug || !id) {
      return Promise.resolve(undefined)
    }
    if (getCached(slug, id)) {
      return Promise.resolve(getCached(slug, id)!)
    }
    return fetchSnapshot(slug, id).catch(() => undefined)
  }

  function getCached (orgSlug: string, projectId: string): ProjectWbsPageSnapshot | null {
    return cacheByKey.get(cacheKey(orgSlug, projectId)) ?? null
  }

  function setCached (
    orgSlug: string,
    projectId: string,
    snapshot: ProjectWbsPageSnapshot,
  ): void {
    cacheByKey.set(cacheKey(orgSlug, projectId), {
      tasks: snapshot.tasks.map(task => ({ ...task })),
      orphanParentLabel: snapshot.orphanParentLabel,
      orphanParentSortOrder: snapshot.orphanParentSortOrder,
      orgLabels: snapshot.orgLabels.map(label => ({ ...label })),
      projectMembers: snapshot.projectMembers.map(member => ({ ...member })),
      projectLists: snapshot.projectLists.map(list => ({ ...list })),
    })
  }

  function invalidateCached (orgSlug: string, projectId: string): void {
    cacheByKey.delete(cacheKey(orgSlug, projectId))
  }

  return {
    fetchSnapshot,
    warmWbsPageCache,
    getCached,
    setCached,
    invalidateCached,
  }
}
