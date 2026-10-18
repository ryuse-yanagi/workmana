import { queryClient } from '../../lib/queryClient'
import { queryKeys } from '../../lib/queryKeys'
import { useApi } from '../shared/useApi'
import { createListWriteGuard } from './listWriteGuard'

export type ArchivedTask = {
  id: number
  title: string
  description?: string | null
  list_id: number | null
  archived_at?: string | null
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  progress_rate?: number | string | null
  is_parent_task?: boolean
  parent_task_id?: number | null
  parent_task_title?: string | null
  archived_child_count?: number
  archived_children?: ArchivedTask[]
  labels?: Array<{ id: number; name: string; color: string }>
  assignees?: Array<{
    id: number
    name: string | null
    email: string | null
    avatar_url: string | null
  }>
}

const archivedTasksRevision = ref(0)
const listWrites = createListWriteGuard<ArchivedTask>()

export function useArchivedTasksRevision(): Ref<number> {
  return archivedTasksRevision
}

function touchArchivedTasks(): void {
  archivedTasksRevision.value += 1
}

function flattenArchivedTasks(tasks: ArchivedTask[]): ArchivedTask[] {
  const flat: ArchivedTask[] = []
  const seen = new Set<number>()
  function walk(task: ArchivedTask) {
    if (seen.has(task.id)) {
      return
    }
    seen.add(task.id)
    flat.push({
      ...task,
      archived_children: [],
      archived_child_count: 0,
    })
    for (const child of task.archived_children ?? []) {
      walk(child)
    }
  }
  for (const task of tasks) {
    walk(task)
  }
  return flat
}

/** 親もアーカイブ済みなら、子はアーカイブ時刻に関係なく親の下へ入れる。 */
export function nestArchivedTasks(tasks: ArchivedTask[]): ArchivedTask[] {
  const flat = flattenArchivedTasks(tasks)
  const byId = new Map(flat.map(task => [task.id, task]))
  const childIds = new Set<number>()
  const childrenByParent = new Map<number, ArchivedTask[]>()
  for (const task of flat) {
    const parentId = task.parent_task_id
    if (parentId == null || !byId.has(parentId)) {
      continue
    }
    childIds.add(task.id)
    const list = childrenByParent.get(parentId) ?? []
    list.push(task)
    childrenByParent.set(parentId, list)
  }
  return flat
    .filter(task => !childIds.has(task.id))
    .map((task) => {
      const nested = childrenByParent.get(task.id) ?? []
      return {
        ...task,
        archived_children: nested,
        archived_child_count: nested.length,
      }
    })
}

export function archivedTaskFromRealtime(task: ArchivedTask): ArchivedTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    list_id: task.list_id,
    archived_at: task.archived_at ?? null,
    labels: task.labels ?? [],
    assignees: task.assignees ?? [],
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    progress_rate: task.progress_rate ?? null,
    is_parent_task: task.is_parent_task ?? false,
    parent_task_id: task.parent_task_id ?? null,
    parent_task_title: task.parent_task_title ?? null,
    archived_child_count: task.archived_child_count
      ?? task.archived_children?.length
      ?? 0,
    archived_children: (task.archived_children ?? []).map(child => archivedTaskFromRealtime(child)),
  }
}

function mergeArchivedTask(tasks: ArchivedTask[], incoming: ArchivedTask): ArchivedTask[] {
  const incomingFlat = flattenArchivedTasks([incoming])
  const incomingIds = new Set(incomingFlat.map(task => task.id))
  const rest = flattenArchivedTasks(tasks).filter(task => !incomingIds.has(task.id))
  return nestArchivedTasks([...incomingFlat, ...rest])
}

function removeArchivedTask(tasks: ArchivedTask[], taskId: number): ArchivedTask[] {
  const flat = flattenArchivedTasks(tasks)
  if (!flat.some(task => task.id === taskId)) {
    return nestArchivedTasks(flat)
  }
  const drop = new Set<number>([taskId])
  let changed = true
  while (changed) {
    changed = false
    for (const task of flat) {
      if (task.parent_task_id == null || !drop.has(task.parent_task_id) || drop.has(task.id)) {
        continue
      }
      drop.add(task.id)
      changed = true
    }
  }
  return nestArchivedTasks(flat.filter(task => !drop.has(task.id)))
}

function cacheKey(orgSlug: string, workspaceId: string | number) {
  return queryKeys.archivedTasks(orgSlug, workspaceId)
}

export function clearAllArchivedTasksCaches(): void {
  listWrites.clear()
  queryClient.removeQueries({ queryKey: ['archivedTasks'] })
  touchArchivedTasks()
}

export function useArchivedTasksCache() {
  const { api } = useApi()

  function getCached(orgSlug: string, workspaceId: string | number): ArchivedTask[] | null {
    return queryClient.getQueryData(cacheKey(orgSlug, workspaceId)) ?? null
  }

  function setCached(orgSlug: string, workspaceId: string | number, tasks: ArchivedTask[]): void {
    queryClient.setQueryData(
      cacheKey(orgSlug, workspaceId),
      nestArchivedTasks(tasks),
    )
    touchArchivedTasks()
  }

  function invalidateCached(orgSlug: string, workspaceId: string | number): void {
    queryClient.removeQueries({
      queryKey: cacheKey(orgSlug, workspaceId),
      exact: true,
    })
  }

  function removeCachedTask(orgSlug: string, workspaceId: string | number, taskId: number): void {
    const key = cacheKey(orgSlug, workspaceId)
    const cached = queryClient.getQueryData<ArchivedTask[]>(key) ?? null
    const next = listWrites.record(key, cached, tasks => removeArchivedTask(tasks, taskId))
    if (next) {
      queryClient.setQueryData(key, next)
    }
    touchArchivedTasks()
  }

  function upsertCachedTask(orgSlug: string, workspaceId: string | number, task: ArchivedTask): void {
    const key = cacheKey(orgSlug, workspaceId)
    const cached = queryClient.getQueryData<ArchivedTask[]>(key) ?? null
    const next = listWrites.record(key, cached, tasks => mergeArchivedTask(tasks, task))
    if (next) {
      queryClient.setQueryData(key, next)
    }
    touchArchivedTasks()
  }

  async function fetchList(
    orgSlug: string,
    workspaceId: string | number,
    opts?: { refresh?: boolean },
  ): Promise<ArchivedTask[]> {
    const key = cacheKey(orgSlug, workspaceId)
    if (!opts?.refresh) {
      const cached = queryClient.getQueryData<ArchivedTask[]>(key)
      if (cached) {
        return nestArchivedTasks(cached.map(task => ({ ...task })))
      }
    }

    const startedAt = listWrites.seen(key)
    const tasks = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const response = await api<{ data: ArchivedTask[] }>(
          `/orgs/${orgSlug.trim()}/workspaces/${workspaceId}/tasks/archived`,
        )
        const serverItems = nestArchivedTasks(response.data.map(task => ({ ...task })))
        const cachedNow = queryClient.getQueryData<ArchivedTask[]>(key) ?? null
        return listWrites.settle(key, startedAt, serverItems, cachedNow).items
      },
      staleTime: 0,
    })
    touchArchivedTasks()
    return nestArchivedTasks(tasks.map(task => ({ ...task })))
  }

  return {
    getCached,
    setCached,
    invalidateCached,
    removeCachedTask,
    upsertCachedTask,
    fetchList,
    clearAllCached: clearAllArchivedTasksCaches,
  }
}
