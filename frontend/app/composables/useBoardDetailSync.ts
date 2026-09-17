import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'
import type { TaskAttachmentsByTaskId, TaskAttachmentItem } from '../components/task/taskAttachmentTypes'
import type { TaskDetail } from '../components/modals/TaskDetailModal.vue'
import type { ArchivedTask } from './useArchivedTasksCache'
import type { ArchivedNamedItem } from './useArchivedNamedItemsCache'
import { resolveParentTaskTitle } from './useTaskCardMeta'
import { restoreDocumentToWorkspaceDetailCache } from './useWorkspaceDetailMeta'

type ApiClient = <T>(url: string, opts?: Record<string, unknown>) => Promise<T>

type RealtimeArchivedSink = {
  addTaskFromRealtime: (task: {
    id: number
    title: string
    list_id: number | null
    archived_at: string
    labels: WorkspaceBoardTask['labels']
    assignees: WorkspaceBoardTask['assignees']
    start_date: string | null
    due_date: string | null
    effort_hours: number | null
    progress_rate: number | null
    is_parent_task: boolean
    parent_task_id: number | null
    parent_task_title: string | null
    archived_child_count: number
    archived_children: unknown[]
  }) => void
} | null

/**
 * タスク詳細モーダルとアーカイブ関連のボード同期グルー。
 */
export function useBoardDetailSync (options: {
  api: ApiClient
  slug: Ref<string> | ComputedRef<string>
  workspaceId: Ref<string> | ComputedRef<string>
  tasks: Ref<WorkspaceBoardTask[] | null>
  error: Ref<string | null>
  detailTaskId: Ref<number | null>
  detailModalRemotePatch: Ref<TaskDetail | null>
  detailModalRemoteRev: Ref<number>
  taskAttachmentsByTaskId: Ref<TaskAttachmentsByTaskId>
  archiveConfirmTask: Ref<WorkspaceBoardTask | null>
  archivedModalRef: Ref<RealtimeArchivedSink>
  addTaskToBoard: (task: WorkspaceBoardTask) => void
  removeTaskFromBoard: (taskId: number, opts?: { removeChildTasks?: boolean }) => void
  rebuildBoardFromTasks: () => void
  syncBoardPageCache: () => void
}) {
  const {
    api,
    slug,
    workspaceId,
    tasks,
    error,
    detailTaskId,
    detailModalRemotePatch,
    detailModalRemoteRev,
    taskAttachmentsByTaskId,
    archiveConfirmTask,
    archivedModalRef,
    addTaskToBoard,
    removeTaskFromBoard,
    rebuildBoardFromTasks,
    syncBoardPageCache,
  } = options

  function pushDetailModalRemote (detail: TaskDetail) {
    if (detailTaskId.value !== detail.id) {
      return
    }
    detailModalRemotePatch.value = detail
    detailModalRemoteRev.value += 1
  }

  function onTaskAttachmentsUpdated (payload: { taskId: number; attachments: TaskAttachmentItem[] }) {
    taskAttachmentsByTaskId.value = {
      ...taskAttachmentsByTaskId.value,
      [String(payload.taskId)]: payload.attachments,
    }
  }

  function onTaskDetailUpdated (detail: TaskDetail) {
    if (!tasks.value) return
    const idx = tasks.value.findIndex(t => t.id === detail.id)
    if (idx < 0) return
    const existing = tasks.value[idx]
    if (!existing) return
    const updated: WorkspaceBoardTask = {
      ...existing,
      title: detail.title,
      description: detail.description ?? null,
      list_id: detail.list_id,
      sort_order: detail.sort_order ?? existing.sort_order,
      start_date: 'start_date' in detail ? detail.start_date : existing.start_date,
      due_date: 'due_date' in detail ? detail.due_date : existing.due_date,
      effort_hours: 'effort_hours' in detail ? detail.effort_hours : existing.effort_hours,
      progress_rate: 'progress_rate' in detail ? detail.progress_rate : existing.progress_rate,
      labels: detail.labels,
      assignees: detail.assignees,
      checklists: 'checklists' in detail ? (detail.checklists ?? []) : (existing.checklists ?? []),
      parent_task_id: 'parent_task_id' in detail ? detail.parent_task_id ?? null : existing.parent_task_id,
      is_parent_task: 'is_parent_task' in detail ? detail.is_parent_task ?? false : existing.is_parent_task,
    }
    const boardLayoutChanged = (
      updated.title !== existing.title
      || (updated.description ?? null) !== (existing.description ?? null)
      || updated.list_id !== existing.list_id
      || (updated.sort_order ?? null) !== (existing.sort_order ?? null)
      || (updated.start_date ?? null) !== (existing.start_date ?? null)
      || (updated.due_date ?? null) !== (existing.due_date ?? null)
      || (updated.effort_hours ?? null) !== (existing.effort_hours ?? null)
      || (updated.progress_rate ?? null) !== (existing.progress_rate ?? null)
      || (updated.parent_task_id ?? null) !== (existing.parent_task_id ?? null)
      || Boolean(updated.is_parent_task) !== Boolean(existing.is_parent_task)
      || JSON.stringify(updated.labels ?? []) !== JSON.stringify(existing.labels ?? [])
      || JSON.stringify(updated.assignees ?? []) !== JSON.stringify(existing.assignees ?? [])
    )
    tasks.value.splice(idx, 1, updated)
    if (boardLayoutChanged) {
      rebuildBoardFromTasks()
    }
    syncBoardPageCache()
  }

  function onArchivedTaskRestored (task: WorkspaceBoardTask, cascadedChildren: ArchivedTask[] = []) {
    if (!tasks.value?.some(t => t.id === task.id)) {
      addTaskToBoard(task)
    }
    for (const child of cascadedChildren) {
      if (tasks.value?.some(t => t.id === child.id)) {
        continue
      }
      addTaskToBoard({
        id: child.id,
        title: child.title,
        list_id: child.list_id,
        sort_order: 0,
        is_parent_task: false,
        parent_task_id: task.id,
        parent_task_title: task.title,
        start_date: child.start_date ?? null,
        due_date: child.due_date ?? null,
        effort_hours: child.effort_hours ?? null,
        progress_rate: child.progress_rate ?? null,
        labels: child.labels ?? [],
        assignees: child.assignees ?? [],
      } as WorkspaceBoardTask)
    }
  }

  async function confirmArchiveFromModal () {
    const task = archiveConfirmTask.value
    if (!task) return
    archiveConfirmTask.value = null
    const boardTasks = tasks.value ?? []
    const snapshot = { ...task }
    const parentTaskTitle = snapshot.parent_task_title
      ?? resolveParentTaskTitle(snapshot, boardTasks)
    const childSnapshots = boardTasks.filter(row => row.parent_task_id === task.id)
    removeTaskFromBoard(task.id, { removeChildTasks: true })
    error.value = null
    try {
      await api(`/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${task.id}/archive`, {
        method: 'POST',
      })
      archivedModalRef.value?.addTaskFromRealtime({
        id: snapshot.id,
        title: snapshot.title,
        list_id: snapshot.list_id,
        archived_at: new Date().toISOString(),
        labels: snapshot.labels ?? [],
        assignees: snapshot.assignees ?? [],
        start_date: snapshot.start_date ?? null,
        due_date: snapshot.due_date ?? null,
        effort_hours: snapshot.effort_hours ?? null,
        progress_rate: snapshot.progress_rate ?? null,
        is_parent_task: snapshot.is_parent_task ?? false,
        parent_task_id: snapshot.parent_task_id ?? null,
        parent_task_title: parentTaskTitle,
        archived_child_count: childSnapshots.length,
        archived_children: childSnapshots.map(child => ({
          id: child.id,
          title: child.title,
          list_id: child.list_id,
          archived_at: new Date().toISOString(),
          labels: child.labels ?? [],
          assignees: child.assignees ?? [],
          start_date: child.start_date ?? null,
          due_date: child.due_date ?? null,
          effort_hours: child.effort_hours ?? null,
          progress_rate: child.progress_rate ?? null,
          is_parent_task: false,
          parent_task_id: snapshot.id,
          parent_task_title: snapshot.title,
          archived_child_count: 0,
          archived_children: [],
        })),
      })
    } catch (e: unknown) {
      addTaskToBoard(snapshot)
      for (const child of childSnapshots) {
        addTaskToBoard(child)
      }
      error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
    }
  }

  function onArchivedDocumentRestored (item: ArchivedNamedItem) {
    restoreDocumentToWorkspaceDetailCache(slug.value, workspaceId.value, {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      category: item.category ?? null,
      workspace_id: item.workspace_id,
      workspace_name: item.workspace_name ?? null,
      body: item.body ?? null,
      archived_at: item.archived_at ?? null,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })
  }

  return {
    pushDetailModalRemote,
    onTaskAttachmentsUpdated,
    onTaskDetailUpdated,
    onArchivedTaskRestored,
    confirmArchiveFromModal,
    onArchivedDocumentRestored,
  }
}
