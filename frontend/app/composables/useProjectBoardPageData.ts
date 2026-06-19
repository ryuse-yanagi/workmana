import type { TaskDetail, TaskDetailMember } from '../components/modals/TaskDetailModal.vue'
import type { TaskCommentsByTaskId } from '../components/task/taskCommentTypes'
import { useApi } from './useApi'
import { useCurrentUser } from './useCurrentUser'
import { useOrgTerminology } from './useOrgTerminology'
export type ProjectBoardLabel = {
  id: number
  name: string
  color: string
}

export type ProjectBoardParentTask = {
  id: number
  title: string
}

export type ProjectBoardTask = {
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
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  labels?: ProjectBoardLabel[]
  assignees?: Array<{
    id: number
    name: string | null
    email: string | null
    avatar_url: string | null
  }>
}

export type ProjectBoardListRow = {
  id: number
  name: string
  sort_order: number
}

export type ProjectBoardPageSnapshot = {
  lists: ProjectBoardListRow[]
  tasks: ProjectBoardTask[]
  orgLabels: ProjectBoardLabel[]
  projectMembers: TaskDetailMember[]
  parentTasks: ProjectBoardParentTask[]
  taskCommentsByTaskId: TaskCommentsByTaskId
  workUnitLabel: string
}

export function boardTaskToTaskDetail (task: ProjectBoardTask): TaskDetail {
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
    labels: task.labels ?? [],
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
  }
}

function cacheKey (orgSlug: string, projectId: string): string {
  return `${orgSlug.trim()}:${projectId.trim()}`
}

const cacheByKey = new Map<string, ProjectBoardPageSnapshot>()
const staleCacheKeys = new Set<string>()

export function useProjectBoardPageData () {
  const { api } = useApi()
  const { ensureCurrentUser } = useCurrentUser()
  const { fetchWorkUnitLabel, syncLabelState } = useOrgTerminology()

  async function fetchSnapshot (
    orgSlug: string,
    projectId: string,
  ): Promise<ProjectBoardPageSnapshot> {
    const slug = orgSlug.trim()
    const id = projectId.trim()
    const [
      listsRes,
      tasksRes,
      labelsRes,
      membersRes,
      parentTasksRes,
      commentsRes,
      workUnitLabel,
    ] = await Promise.all([
      api<{ data: ProjectBoardListRow[] }>(`/orgs/${slug}/projects/${id}/lists`),
      api<{ data: ProjectBoardTask[] }>(`/orgs/${slug}/projects/${id}/tasks`),
      api<{ data: ProjectBoardLabel[] }>(`/orgs/${slug}/task-labels`),
      api<{ data: TaskDetailMember[] }>(`/orgs/${slug}/projects/${id}/members`),
      api<{ data: ProjectBoardParentTask[] }>(`/orgs/${slug}/projects/${id}/tasks/parents`),
      api<{ data: TaskCommentsByTaskId }>(`/orgs/${slug}/projects/${id}/tasks/comments`),
      fetchWorkUnitLabel(slug),
      ensureCurrentUser(),
    ])
    syncLabelState(slug, workUnitLabel)
    const snapshot: ProjectBoardPageSnapshot = {
      lists: listsRes.data,
      tasks: tasksRes.data,
      orgLabels: labelsRes.data,
      projectMembers: membersRes.data,
      parentTasks: parentTasksRes.data,
      taskCommentsByTaskId: commentsRes.data ?? {},
      workUnitLabel,
    }
    cacheByKey.set(cacheKey(slug, id), snapshot)
    clearCachedStale(slug, id)
    return snapshot
  }

  /** カンバン画面へ遷移する前に呼ぶ（常に最新データを取得してキャッシュする） */
  async function prefetch (orgSlug: string, projectId: string): Promise<ProjectBoardPageSnapshot> {
    return fetchSnapshot(orgSlug, projectId)
  }

  function getCached (orgSlug: string, projectId: string): ProjectBoardPageSnapshot | null {
    return cacheByKey.get(cacheKey(orgSlug, projectId)) ?? null
  }

  function invalidateCached (orgSlug: string, projectId: string): void {
    const key = cacheKey(orgSlug, projectId)
    cacheByKey.delete(key)
    staleCacheKeys.delete(key)
  }

  function markCachedStale (orgSlug: string, projectId: string): void {
    staleCacheKeys.add(cacheKey(orgSlug, projectId))
  }

  function isCachedStale (orgSlug: string, projectId: string): boolean {
    return staleCacheKeys.has(cacheKey(orgSlug, projectId))
  }

  function clearCachedStale (orgSlug: string, projectId: string): void {
    staleCacheKeys.delete(cacheKey(orgSlug, projectId))
  }

  function patchCachedTasks (
    orgSlug: string,
    projectId: string,
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
      effort_hours?: number | string | null
      effort_value?: number | string | null
      effort_unit?: string | null
      labels?: ProjectBoardLabel[]
      assignees?: ProjectBoardTask['assignees']
    }>,
  ): void {
    const key = cacheKey(orgSlug, projectId)
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
        ...(patch.effort_hours !== undefined ? { effort_hours: patch.effort_hours } : {}),
        ...(patch.effort_value !== undefined ? { effort_value: patch.effort_value } : {}),
        ...(patch.effort_unit !== undefined ? { effort_unit: patch.effort_unit } : {}),
        ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
        ...(patch.assignees !== undefined ? { assignees: patch.assignees } : {}),
      }
    })
    cacheByKey.set(key, { ...cached, tasks })
  }

  function replaceCachedBoardState (
    orgSlug: string,
    projectId: string,
    partial: {
      tasks?: ProjectBoardTask[]
      parentTasks?: ProjectBoardParentTask[]
    },
  ): void {
    const key = cacheKey(orgSlug, projectId)
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
    clearCachedStale(orgSlug, projectId)
  }

  return {
    fetchSnapshot,
    prefetch,
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
