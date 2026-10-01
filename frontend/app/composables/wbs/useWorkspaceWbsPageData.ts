import type { WorkspaceListOption } from '../task/useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from '../task/useTaskFormHelpers'
import type { WbsTask } from './useWbsTaskGroups'
import { useApi } from '../shared/useApi'
import {
  flattenLabelCategories,
  normalizeLabelCategories,
  resolveAndSortLabels,
  type LabelCategoryGroup,
} from '../label/useLabelCategories'
import { resolveListColors } from '../../utils/shared/colorPresetResolution'
import { sortMembersByDisplayName } from '../member/useMemberDisplay'
import { getCachedWorkspaceAssignees } from '../workspace/useOrgWorkspaceIndexPageData'
export type WorkspaceWbsPageSnapshot = {
  tasks: WbsTask[]
  orgLabels: TaskFormLabel[]
  orgLabelCategories: LabelCategoryGroup[]
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

export function getWorkspaceWbsCacheMap (): Map<string, WorkspaceWbsPageSnapshot> {
  return cacheByKey
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
      const [tasksRes, labelCategoriesRes, listsRes] = await Promise.all([
        api<{ data: WbsTask[] }>(
          `/orgs/${slug}/workspaces/${id}/tasks/wbs`,
        ),
        api<{ data: LabelCategoryGroup[] }>(
          `/orgs/${slug}/task-label-categories`,
        ),
        api<{ data: WorkspaceListOption[] }>(
          `/orgs/${slug}/workspaces/${id}/lists`,
        ),
      ])
      const orgLabelCategories = normalizeLabelCategories(labelCategoriesRes.data ?? [])
      const orgLabels = flattenLabelCategories(orgLabelCategories)
      const snapshot: WorkspaceWbsPageSnapshot = {
        tasks: (tasksRes.data ?? []).map(task => ({
          ...task,
          assignees: sortMembersByDisplayName(task.assignees ?? []),
          labels: task.labels ? resolveAndSortLabels(task.labels, orgLabels) : task.labels,
        })),
        orgLabels,
        orgLabelCategories,
        workspaceMembers: getCachedWorkspaceAssignees(slug, id),
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
      orgLabelCategories: (snapshot.orgLabelCategories ?? []).map(category => ({
        ...category,
        labels: category.labels.map(label => ({ ...label })),
      })),
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
