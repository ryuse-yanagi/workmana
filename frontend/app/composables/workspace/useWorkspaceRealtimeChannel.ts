import type { Ref } from 'vue'
import { resolveAndSortLabels } from '../label/useLabelCategories'
import { resolveAvatarUrl } from '../../utils/member/resolveAvatarUrl'
import { sortMembersByDisplayName } from '../member/useMemberDisplay'
export type RealtimeBoardTask = {
  id: number
  title: string
  list_id: number | null
  sort_order?: number
  is_parent_task?: boolean
  parent_task_id?: number | null
  description?: string | null
  start_date?: string | null
  due_date?: string | null
  gantt_bar_color?: string | null
  effort_hours?: number | string | null
  progress_rate?: number | string | null
  labels?: Array<{ id: number; name: string; color_index?: number; color: string }>
  assignees?: Array<{ id: number; name: string | null; email: string | null; avatar_url: string | null }>
}
export type RealtimeArchivedTask = {
  id: number
  title: string
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
  archived_children?: RealtimeArchivedTask[]
  labels?: Array<{ id: number; name: string; color_index?: number; color: string }>
  assignees?: Array<{ id: number; name: string | null; email: string | null; avatar_url: string | null }>
}
export type RealtimeWbsReorderItem = {
  id: number
  sort_order: number
  parent_task_id: number | null
}
export type RealtimeWorkspaceMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
type EchoChannel = {
  listen: (event: string, cb: (payload: unknown) => void) => EchoChannel
}
type EchoClient = {
  private: (channel: string) => EchoChannel
  leave: (channel: string) => void
  connector?: {
    pusher?: {
      connection: {
        state: string
        bind: (event: string, cb: () => void) => void
        unbind: (event: string, cb?: () => void) => void
      }
    }
  }
}
export type ProjectRealtimeHandlers = {
  onTaskCreated?: (task: RealtimeBoardTask) => void
  onTaskUpdated?: (task: RealtimeBoardTask) => void
  onTaskArchived?: (payload: {
    id: number
    task?: RealtimeArchivedTask
    cascaded_task_ids?: number[]
  }) => void
  onTaskRestored?: (task: RealtimeBoardTask) => void
  onTaskDeleted?: (taskId: number) => void
  onTasksReordered?: (payload: { list_id: number; task_ids: number[] }) => void
  onWbsTasksReordered?: (tasks: RealtimeWbsReorderItem[]) => void
  onListCreated?: () => void
  onListUpdated?: (list: {
    id: number
    name: string
    color_index: number
    sort_order: number
  }) => void
  onListDeleted?: (listId: number) => void
  onListsReordered?: (payload: { list_ids: number[] }) => void
  onWorkspaceMembersUpdated?: (payload: {
    members: RealtimeWorkspaceMember[]
    removed_member_ids: number[]
  }) => void
}
export function useWorkspaceRealtimeChannel (
  workspaceId: Ref<string>,
  handlers: ProjectRealtimeHandlers,
) {
  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '/api')
  let channelName: string | null = null
  let subscribed = false
  let subscribeGeneration = 0
  let connectedHandler: (() => void) | null = null
  let failedHandler: (() => void) | null = null
  function withResolvedAssigneeAvatars<T extends { assignees?: Array<{ id: number; name: string | null; email: string | null; avatar_url: string | null }> }> (task: T): T {
    if (!task.assignees?.length) {
      return task
    }
    return {
      ...task,
      assignees: sortMembersByDisplayName(task.assignees.map(assignee => ({
        ...assignee,
        avatar_url: resolveAvatarUrl(assignee.avatar_url, apiBase),
      }))),
    }
  }
  /** 受信タスクのアバター URL を解決し、ラベルをカタログ順に揃える。 */
  function normalizeRealtimeTask (task: RealtimeBoardTask): RealtimeBoardTask {
    const withAvatars = withResolvedAssigneeAvatars(task)
    if (!withAvatars.labels?.length) {
      return withAvatars
    }
    return {
      ...withAvatars,
      labels: resolveAndSortLabels(withAvatars.labels),
    }
  }
  function normalizeRealtimeMembers (members: RealtimeWorkspaceMember[]): RealtimeWorkspaceMember[] {
    return sortMembersByDisplayName(members.map(member => ({
      ...member,
      avatar_url: resolveAvatarUrl(member.avatar_url, apiBase),
    })))
  }
  function normalizeRealtimeArchivedTask (task: RealtimeArchivedTask): RealtimeArchivedTask {
    const withAvatars = withResolvedAssigneeAvatars(task)
    const labels = withAvatars.labels?.length
      ? resolveAndSortLabels(withAvatars.labels)
      : withAvatars.labels
    return {
      ...withAvatars,
      labels,
      archived_children: (withAvatars.archived_children ?? []).map(child => (
        normalizeRealtimeArchivedTask(child)
      )),
      archived_child_count: withAvatars.archived_child_count
        ?? withAvatars.archived_children?.length
        ?? 0,
    }
  }
  function bindListeners (channel: EchoChannel) {
    if (handlers.onTaskCreated) {
      channel.listen('.TaskCreated', (payload: unknown) => {
        const data = payload as { task?: RealtimeBoardTask }
        if (data?.task) {
          handlers.onTaskCreated!(normalizeRealtimeTask(data.task))
        }
      })
    }
    if (handlers.onTaskUpdated) {
      channel.listen('.TaskUpdated', (payload: unknown) => {
        const data = payload as { task?: RealtimeBoardTask }
        if (data?.task) {
          handlers.onTaskUpdated!(normalizeRealtimeTask(data.task))
        }
      })
    }
    if (handlers.onTaskArchived) {
      channel.listen('.TaskArchived', (payload: unknown) => {
        const data = payload as {
          id?: number
          task?: RealtimeArchivedTask
          cascaded_task_ids?: number[]
        }
        if (typeof data?.id === 'number') {
          handlers.onTaskArchived!({
            id: data.id,
            task: data.task ? normalizeRealtimeArchivedTask(data.task) : undefined,
            cascaded_task_ids: Array.isArray(data.cascaded_task_ids)
              ? data.cascaded_task_ids.filter((id): id is number => typeof id === 'number')
              : [],
          })
        }
      })
    }
    if (handlers.onTaskRestored) {
      channel.listen('.TaskRestored', (payload: unknown) => {
        const data = payload as { task?: RealtimeBoardTask }
        if (data?.task) {
          handlers.onTaskRestored!(normalizeRealtimeTask(data.task))
        }
      })
    }
    if (handlers.onTaskDeleted) {
      channel.listen('.TaskDeleted', (payload: unknown) => {
        const data = payload as { id?: number }
        if (typeof data?.id === 'number') {
          handlers.onTaskDeleted!(data.id)
        }
      })
    }
    if (handlers.onTasksReordered) {
      channel.listen('.TasksReordered', (payload: unknown) => {
        const data = payload as { list_id?: number; task_ids?: number[] }
        if (typeof data?.list_id === 'number' && Array.isArray(data.task_ids)) {
          handlers.onTasksReordered!({
            list_id: data.list_id,
            task_ids: data.task_ids,
          })
        }
      })
    }
    if (handlers.onWbsTasksReordered) {
      channel.listen('.WbsTasksReordered', (payload: unknown) => {
        const data = payload as { tasks?: RealtimeWbsReorderItem[] }
        if (!Array.isArray(data?.tasks)) {
          return
        }
        const tasks = data.tasks.filter((item): item is RealtimeWbsReorderItem => (
          item != null
          && typeof item.id === 'number'
          && typeof item.sort_order === 'number'
          && (item.parent_task_id === null || typeof item.parent_task_id === 'number')
        ))
        if (tasks.length > 0) {
          handlers.onWbsTasksReordered!(tasks)
        }
      })
    }
    if (handlers.onListCreated) {
      channel.listen('.ListCreated', () => {
        handlers.onListCreated!()
      })
    }
    if (handlers.onListUpdated) {
      channel.listen('.ListUpdated', (payload: unknown) => {
        const data = payload as { list?: { id: number; name: string; color_index: number; sort_order: number } }
        if (data?.list) {
          handlers.onListUpdated!(data.list)
        }
      })
    }
    if (handlers.onListDeleted) {
      channel.listen('.ListDeleted', (payload: unknown) => {
        const data = payload as { id?: number }
        if (typeof data?.id === 'number') {
          handlers.onListDeleted!(data.id)
        }
      })
    }
    if (handlers.onListsReordered) {
      channel.listen('.ListsReordered', (payload: unknown) => {
        const data = payload as { list_ids?: number[] }
        if (Array.isArray(data?.list_ids)) {
          handlers.onListsReordered!({ list_ids: data.list_ids })
        }
      })
    }
    if (handlers.onWorkspaceMembersUpdated) {
      channel.listen('.WorkspaceMembersUpdated', (payload: unknown) => {
        const data = payload as {
          members?: RealtimeWorkspaceMember[]
          removed_member_ids?: number[]
        }
        if (!Array.isArray(data?.members)) {
          return
        }
        handlers.onWorkspaceMembersUpdated!({
          members: normalizeRealtimeMembers(data.members),
          removed_member_ids: Array.isArray(data.removed_member_ids)
            ? data.removed_member_ids.filter((id): id is number => typeof id === 'number')
            : [],
        })
      })
    }
  }
  function clearConnectionHandlers (echo: EchoClient | null | undefined) {
    const connection = echo?.connector?.pusher?.connection
    if (!connection) {
      connectedHandler = null
      failedHandler = null
      return
    }
    if (connectedHandler) {
      connection.unbind('connected', connectedHandler)
      connectedHandler = null
    }
    if (failedHandler) {
      connection.unbind('failed', failedHandler)
      failedHandler = null
    }
  }
  function subscribe () {
    if (!import.meta.client) {
      return
    }
    const nuxtApp = useNuxtApp()
    const echo = (nuxtApp as unknown as { $echo?: EchoClient | null }).$echo
    if (!echo) {
      console.warn('[realtime] Echo is not initialized — check console for [echo] errors')
      return
    }
    const nextChannel = `workspaces.${workspaceId.value}`
    if (channelName && channelName !== nextChannel) {
      echo.leave(channelName)
      subscribed = false
    }
    channelName = nextChannel
    const generation = ++subscribeGeneration
    clearConnectionHandlers(echo)
    const attach = () => {
      if (generation !== subscribeGeneration) {
        return
      }
      if (subscribed) {
        return
      }
      // 再接続時に同じチャネルへ二重 listen しないよう一度 leave してから bind
      echo.leave(nextChannel)
      subscribed = true
      bindListeners(echo.private(nextChannel))
    }
    const onFailed = () => {
      if (generation !== subscribeGeneration) {
        return
      }
      subscribed = false
      echo.leave(nextChannel)
      console.error('[realtime] WebSocket connection failed — is `php artisan reverb:start` running?')
    }
    const pusher = echo.connector?.pusher
    if (pusher?.connection.state === 'connected') {
      attach()
      return
    }
    connectedHandler = attach
    failedHandler = onFailed
    pusher?.connection.bind('connected', attach)
    pusher?.connection.bind('failed', onFailed)
  }
  function unsubscribe () {
    if (!import.meta.client) {
      return
    }
    subscribeGeneration += 1
    const nuxtApp = useNuxtApp()
    const echo = (nuxtApp as unknown as { $echo?: EchoClient | null }).$echo
    clearConnectionHandlers(echo)
    if (channelName) {
      echo?.leave(channelName)
    }
    channelName = null
    subscribed = false
  }
  watch(workspaceId, () => {
    if (!import.meta.client) {
      return
    }
    unsubscribe()
    subscribe()
  })
  onMounted(() => {
    subscribe()
  })
  onBeforeUnmount(() => {
    unsubscribe()
  })
}
