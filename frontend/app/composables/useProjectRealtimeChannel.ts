import type { Ref } from 'vue'

export type RealtimeBoardTask = {
  id: number
  title: string
  status: string
  list_id: number | null
  sort_order?: number
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  labels?: Array<{ id: number; name: string; color: string }>
  assignees?: Array<{ id: number; name: string | null; email: string | null; avatar_url: string | null }>
}

export type RealtimeArchivedTask = {
  id: number
  title: string
  status: string
  list_id: number | null
  archived_at?: string | null
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  labels?: Array<{ id: number; name: string; color: string }>
  assignees?: Array<{ id: number; name: string | null; email: string | null; avatar_url: string | null }>
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
      }
    }
  }
}

export type ProjectRealtimeHandlers = {
  onTaskCreated?: (task: RealtimeBoardTask) => void
  onTaskUpdated?: (task: RealtimeBoardTask) => void
  onTaskArchived?: (payload: { id: number; task?: RealtimeArchivedTask }) => void
  onTaskRestored?: (task: RealtimeBoardTask) => void
  onTaskDeleted?: (taskId: number) => void
  onTasksReordered?: (payload: { list_id: number; task_ids: number[] }) => void
  onListCreated?: () => void
  onListUpdated?: (list: { id: number; name: string; color: string; sort_order: number }) => void
  onListDeleted?: (listId: number) => void
  onListsReordered?: (payload: { list_ids: number[] }) => void
}

export function useProjectRealtimeChannel (
  projectId: Ref<string>,
  handlers: ProjectRealtimeHandlers,
) {
  let channelName: string | null = null
  let subscribed = false

  function bindListeners (channel: EchoChannel) {
    if (handlers.onTaskCreated) {
      channel.listen('.TaskCreated', (payload: unknown) => {
        const data = payload as { task?: RealtimeBoardTask }
        if (data?.task) {
          handlers.onTaskCreated!(data.task)
        }
      })
    }

    if (handlers.onTaskUpdated) {
      channel.listen('.TaskUpdated', (payload: unknown) => {
        const data = payload as { task?: RealtimeBoardTask }
        if (data?.task) {
          handlers.onTaskUpdated!(data.task)
        }
      })
    }

    if (handlers.onTaskArchived) {
      channel.listen('.TaskArchived', (payload: unknown) => {
        const data = payload as { id?: number; task?: RealtimeArchivedTask }
        if (typeof data?.id === 'number') {
          handlers.onTaskArchived!({ id: data.id, task: data.task })
        }
      })
    }

    if (handlers.onTaskRestored) {
      channel.listen('.TaskRestored', (payload: unknown) => {
        const data = payload as { task?: RealtimeBoardTask }
        if (data?.task) {
          handlers.onTaskRestored!(data.task)
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

    if (handlers.onListCreated) {
      channel.listen('.ListCreated', () => {
        handlers.onListCreated!()
      })
    }

    if (handlers.onListUpdated) {
      channel.listen('.ListUpdated', (payload: unknown) => {
        const data = payload as { list?: { id: number; name: string; color: string; sort_order: number } }
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

    const nextChannel = `projects.${projectId.value}`
    if (channelName && channelName !== nextChannel) {
      echo.leave(channelName)
      subscribed = false
    }
    channelName = nextChannel

    const attach = () => {
      if (subscribed) {
        return
      }
      subscribed = true
      bindListeners(echo.private(nextChannel))
    }

    const pusher = echo.connector?.pusher
    if (pusher?.connection.state === 'connected') {
      attach()
      return
    }
    pusher?.connection.bind('connected', attach)
    pusher?.connection.bind('failed', () => {
      subscribed = false
      console.error('[realtime] WebSocket connection failed — is `php artisan reverb:start` running?')
    })
  }

  function unsubscribe () {
    if (!import.meta.client || !channelName) {
      return
    }
    const nuxtApp = useNuxtApp()
    const echo = (nuxtApp as unknown as { $echo?: EchoClient | null }).$echo
    echo?.leave(channelName)
    channelName = null
    subscribed = false
  }

  watch(projectId, () => {
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
