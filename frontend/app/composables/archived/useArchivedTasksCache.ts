import { queryClient } from '../../lib/queryClient'

import { queryKeys } from '../../lib/queryKeys'

import { useApi } from '../shared/useApi'

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

export function nestArchivedTasks (tasks: ArchivedTask[]): ArchivedTask[] {
  const ids = new Set(tasks.map(task => task.id))
  const childrenByParent = new Map<number, ArchivedTask[]>()
  for (const task of tasks) {
    const parentId = task.parent_task_id
    if (parentId == null || !ids.has(parentId)) {
      continue
    }
    const children = childrenByParent.get(parentId) ?? []
    children.push(task)
    childrenByParent.set(parentId, children)
  }
  return tasks
    .filter(task => task.parent_task_id == null || !ids.has(task.parent_task_id))
    .map((task) => {
      const nested = task.archived_children?.length
        ? task.archived_children
        : (childrenByParent.get(task.id) ?? [])
      return {
        ...task,
        archived_children: nested,
        archived_child_count: nested.length,
      }
    })
}

export function clearAllArchivedTasksCaches (): void {

  queryClient.removeQueries({ queryKey: ['archivedTasks'] })

}

export function useArchivedTasksCache () {

  const { api } = useApi()

  function getCached (orgSlug: string, workspaceId: string | number): ArchivedTask[] | null {

    return queryClient.getQueryData(queryKeys.archivedTasks(orgSlug, workspaceId)) ?? null

  }

  function setCached (orgSlug: string, workspaceId: string | number, tasks: ArchivedTask[]): void {

    queryClient.setQueryData(

      queryKeys.archivedTasks(orgSlug, workspaceId),

      tasks.map(task => ({ ...task })),

    )

  }

  function invalidateCached (orgSlug: string, workspaceId: string | number): void {

    queryClient.removeQueries({

      queryKey: queryKeys.archivedTasks(orgSlug, workspaceId),

      exact: true,

    })

  }

  function removeCachedTask (orgSlug: string, workspaceId: string | number, taskId: number): void {

    const key = queryKeys.archivedTasks(orgSlug, workspaceId)

    const cached = queryClient.getQueryData<ArchivedTask[]>(key)

    if (!cached) return

    queryClient.setQueryData(key, cached.filter(task => task.id !== taskId))

  }

  function upsertCachedTask (orgSlug: string, workspaceId: string | number, task: ArchivedTask): void {

    const key = queryKeys.archivedTasks(orgSlug, workspaceId)

    const cached = queryClient.getQueryData<ArchivedTask[]>(key)

    if (!cached) return

    const index = cached.findIndex(existing => existing.id === task.id)

    if (index >= 0) {

      const next = [...cached]

      next[index] = { ...task }

      queryClient.setQueryData(key, next)

      return

    }

    queryClient.setQueryData(key, [{ ...task }, ...cached])

  }

  async function fetchList (

    orgSlug: string,

    workspaceId: string | number,

    opts?: { refresh?: boolean },

  ): Promise<ArchivedTask[]> {

    const key = queryKeys.archivedTasks(orgSlug, workspaceId)

    if (opts?.refresh) {

      queryClient.removeQueries({ queryKey: key, exact: true })

    } else {

      const cached = queryClient.getQueryData<ArchivedTask[]>(key)

      if (cached) {

        return nestArchivedTasks(cached.map(task => ({ ...task })))

      }

    }

    const tasks = await queryClient.fetchQuery({

      queryKey: key,

      queryFn: async () => {

        const response = await api<{ data: ArchivedTask[] }>(

          `/orgs/${orgSlug.trim()}/workspaces/${workspaceId}/tasks/archived`,

        )

        return nestArchivedTasks(response.data.map(task => ({ ...task })))

      },

      staleTime: 0,

    })

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

