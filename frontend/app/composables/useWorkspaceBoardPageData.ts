import type { TaskDetail, TaskDetailMember } from '../components/modals/TaskDetailModal.vue'
import type { TaskChecklist } from '../components/task/TaskDetailChecklistBlock.vue'
import type { TaskCommentsByTaskId } from '../components/task/taskCommentTypes'
import { useApi } from './useApi'
import { useCurrentUser } from './useCurrentUser'
import { resolveLabelColors, resolveListColors } from '../utils/colorPresetResolution'
export type WorkspaceBoardLabel = {
  id: number
  name: string
  color: string
  color_index?: number
}
export type WorkspaceBoardParentTask = {
  id: number
  title: string
}
export type WorkspaceBoardTask = {
  id: number
  title: string
  description?: string | null
  status: string
  list_id: number | null
  is_parent_task?: boolean
  parent_task_id?: number | null
  sort_order?: number
  start_date?: string | null
  due_date?: string | null
  gantt_bar_color?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  labels?: WorkspaceBoardLabel[]
  assignees?: Array<{
    id: number
    name: string | null
    email: string | null
    avatar_url: string | null
  }>
  checklist?: TaskChecklist | null
}
export type WorkspaceBoardListRow = {
  id: number
  name: string
  color: string
  color_index?: number
  sort_order: number
}
export type WorkspaceBoardPageSnapshot = {
  lists: WorkspaceBoardListRow[]
  tasks: WorkspaceBoardTask[]
  orgLabels: WorkspaceBoardLabel[]
  workspaceMembers: TaskDetailMember[]
  parentTasks: WorkspaceBoardParentTask[]
  taskCommentsByTaskId: TaskCommentsByTaskId
}
export function boardTaskToTaskDetail (task: WorkspaceBoardTask): TaskDetail {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    list_id: task.list_id,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    effort_value: task.effort_value ?? null,
    effort_unit: task.effort_unit ?? null,
    assignees: (task.assignees ?? []) as TaskDetailMember[],
    labels: task.labels ? resolveLabelColors(task.labels) : [],
    checklist: task.checklist ?? null,
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
  }
}
function cacheKey (orgSlug: string, workspaceId: string): string {
  return `${orgSlug.trim()}:${workspaceId.trim()}`
}
const cacheByKey = new Map<string, WorkspaceBoardPageSnapshot>()
const staleCacheKeys = new Set<string>()
const inflightByKey = new Map<string, Promise<WorkspaceBoardPageSnapshot>>()
export function useWorkspaceBoardPageData () {
  const { api } = useApi()
  const { ensureCurrentUser } = useCurrentUser()
  async function fetchSnapshot (
    orgSlug: string,
    workspaceId: string,
  ): Promise<WorkspaceBoardPageSnapshot> {
    const slug = orgSlug.trim()
    const id = workspaceId.trim()
    const key = cacheKey(slug, id)
    const inflight = inflightByKey.get(key)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const [
        listsRes,
        tasksRes,
        labelsRes,
        membersRes,
        parentTasksRes,
        commentsRes,
      ] = await Promise.all([
        api<{ data: WorkspaceBoardListRow[] }>(`/orgs/${slug}/workspaces/${id}/lists`),
        api<{ data: WorkspaceBoardTask[] }>(`/orgs/${slug}/workspaces/${id}/tasks`),
        api<{ data: WorkspaceBoardLabel[] }>(`/orgs/${slug}/task-labels`),
        api<{ data: TaskDetailMember[] }>(`/orgs/${slug}/workspaces/${id}/members`),
        api<{ data: WorkspaceBoardParentTask[] }>(`/orgs/${slug}/workspaces/${id}/tasks/parents`),
        api<{ data: TaskCommentsByTaskId }>(`/orgs/${slug}/workspaces/${id}/tasks/comments`),
        ensureCurrentUser(),
      ])
      const snapshot: WorkspaceBoardPageSnapshot = {
        lists: resolveListColors(listsRes.data),
        tasks: tasksRes.data.map(task => ({
          ...task,
          labels: task.labels ? resolveLabelColors(task.labels) : task.labels,
        })),
        orgLabels: resolveLabelColors(labelsRes.data),
        workspaceMembers: membersRes.data,
        parentTasks: parentTasksRes.data,
        taskCommentsByTaskId: commentsRes.data ?? {},
      }
      cacheByKey.set(key, snapshot)
      clearCachedStale(slug, id)
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
  /** キャッシュ済みなら API を叩かず、未取得ならバックグラウンドで取得する */
  function warmWorkspaceBoardCache (
    orgSlug: string,
    workspaceId: string,
  ): Promise<WorkspaceBoardPageSnapshot | undefined> {
    const slug = orgSlug.trim()
    const id = workspaceId.trim()
    if (!slug || !id) {
      return Promise.resolve(undefined)
    }
    if (!isCachedStale(slug, id)) {
      const cached = getCached(slug, id)
      if (cached) {
        return Promise.resolve(cached)
      }
    }
    return fetchSnapshot(slug, id).catch(() => undefined)
  }
  /** ボード画面へ遷移する前に呼ぶ（キャッシュ済みなら API を叩かない） */
  async function prefetch (orgSlug: string, workspaceId: string): Promise<WorkspaceBoardPageSnapshot> {
    const slug = orgSlug.trim()
    const id = workspaceId.trim()
    if (!isCachedStale(slug, id)) {
      const cached = getCached(slug, id)
      if (cached) {
        return cached
      }
    }
    return fetchSnapshot(slug, id)
  }
  function getCached (orgSlug: string, workspaceId: string): WorkspaceBoardPageSnapshot | null {
    return cacheByKey.get(cacheKey(orgSlug, workspaceId)) ?? null
  }
  function invalidateCached (orgSlug: string, workspaceId: string): void {
    const key = cacheKey(orgSlug, workspaceId)
    cacheByKey.delete(key)
    staleCacheKeys.delete(key)
  }
  function markCachedStale (orgSlug: string, workspaceId: string): void {
    staleCacheKeys.add(cacheKey(orgSlug, workspaceId))
  }
  function isCachedStale (orgSlug: string, workspaceId: string): boolean {
    return staleCacheKeys.has(cacheKey(orgSlug, workspaceId))
  }
  function clearCachedStale (orgSlug: string, workspaceId: string): void {
    staleCacheKeys.delete(cacheKey(orgSlug, workspaceId))
  }
  function patchCachedTasks (
    orgSlug: string,
    workspaceId: string,
    patches: Array<{
      id: number
      title?: string
      description?: string | null
      list_id?: number | null
      sort_order?: number
      parent_task_id?: number | null
      is_parent_task?: boolean
      start_date?: string | null
      due_date?: string | null
      gantt_bar_color?: string | null
      effort_hours?: number | string | null
      effort_value?: number | string | null
      effort_unit?: string | null
      labels?: WorkspaceBoardLabel[]
      assignees?: WorkspaceBoardTask['assignees']
      checklist?: TaskChecklist | null
    }>,
  ): void {
    const key = cacheKey(orgSlug, workspaceId)
    const cached = cacheByKey.get(key)
    if (!cached || patches.length === 0) {
      return
    }
    const patchById = new Map(patches.map(patch => [patch.id, patch]))
    const tasks = cached.tasks.map((task) => {
      const patch = patchById.get(task.id)
      if (!patch) {
        return task
      }
      return {
        ...task,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.list_id !== undefined ? { list_id: patch.list_id } : {}),
        ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
        ...(patch.parent_task_id !== undefined ? { parent_task_id: patch.parent_task_id } : {}),
        ...(patch.is_parent_task !== undefined ? { is_parent_task: patch.is_parent_task } : {}),
        ...(patch.start_date !== undefined ? { start_date: patch.start_date } : {}),
        ...(patch.due_date !== undefined ? { due_date: patch.due_date } : {}),
        ...(patch.gantt_bar_color !== undefined ? { gantt_bar_color: patch.gantt_bar_color } : {}),
        ...(patch.effort_hours !== undefined ? { effort_hours: patch.effort_hours } : {}),
        ...(patch.effort_value !== undefined ? { effort_value: patch.effort_value } : {}),
        ...(patch.effort_unit !== undefined ? { effort_unit: patch.effort_unit } : {}),
        ...(patch.labels !== undefined ? { labels: resolveLabelColors(patch.labels) } : {}),
        ...(patch.assignees !== undefined ? { assignees: patch.assignees } : {}),
        ...(patch.checklist !== undefined ? { checklist: patch.checklist } : {}),
      }
    })
    cacheByKey.set(key, { ...cached, tasks })
  }
  function replaceCachedBoardState (
    orgSlug: string,
    workspaceId: string,
    partial: {
      tasks?: WorkspaceBoardTask[]
      parentTasks?: WorkspaceBoardParentTask[]
    },
  ): void {
    const key = cacheKey(orgSlug, workspaceId)
    const cached = cacheByKey.get(key)
    if (!cached) {
      return
    }
    cacheByKey.set(key, {
      ...cached,
      ...(partial.tasks !== undefined
        ? { tasks: partial.tasks.map(task => ({ ...task })) }
        : {}),
      ...(partial.parentTasks !== undefined
        ? { parentTasks: partial.parentTasks.map(task => ({ ...task })) }
        : {}),
    })
    clearCachedStale(orgSlug, workspaceId)
  }
  return {
    fetchSnapshot,
    prefetch,
    warmWorkspaceBoardCache,
    getCached,
    invalidateCached,
    markCachedStale,
    isCachedStale,
    clearCachedStale,
    patchCachedTasks,
    replaceCachedBoardState,
    boardTaskToTaskDetail,
  }
}
