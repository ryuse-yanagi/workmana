import type { Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'

type ListDefLike = {
  key: string
  listId: number
}

/**
 * ボード上の tasks / lists から tasksByList を再構築し、CRUD 同期ヘルパを提供する。
 */
export function useBoardTaskModel (options: {
  lists: Ref<ListDefLike[]>
  tasks: Ref<WorkspaceBoardTask[] | null>
  tasksByList: Record<string, WorkspaceBoardTask[]>
  syncBoardPageCache: () => void
}) {
  function rebuildBoardFromTasks () {
    for (const key of Object.keys(options.tasksByList)) {
      delete options.tasksByList[key]
    }
    for (const list of options.lists.value) {
      options.tasksByList[list.key] = []
    }
    for (const task of options.tasks.value ?? []) {
      const key = task.list_id === null ? '' : `list_${task.list_id}`
      if (!key || !options.tasksByList[key]) continue
      options.tasksByList[key].push(task)
    }
    for (const list of options.lists.value) {
      const arr = options.tasksByList[list.key]
      if (!arr?.length) continue
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
    }
  }

  function addTaskToBoard (task: WorkspaceBoardTask) {
    if (!options.tasks.value) {
      options.tasks.value = []
    }
    options.tasks.value.push(task)
    rebuildBoardFromTasks()
    options.syncBoardPageCache()
  }

  function removeTaskFromBoard (taskId: number, removeOptions?: { removeChildTasks?: boolean }) {
    if (!options.tasks.value) return
    const removeChildTasks = removeOptions?.removeChildTasks ?? false
    const removeIds = new Set<number>([taskId])
    if (removeChildTasks) {
      for (const task of options.tasks.value) {
        if (task.parent_task_id === taskId) {
          removeIds.add(task.id)
        }
      }
    }
    options.tasks.value = options.tasks.value.filter(task => !removeIds.has(task.id))
    rebuildBoardFromTasks()
    options.syncBoardPageCache()
  }

  function applyTasksReordered (listId: number, taskIds: number[]) {
    if (!options.tasks.value) {
      return
    }
    taskIds.forEach((id, index) => {
      const task = options.tasks.value?.find(t => t.id === id)
      if (task) {
        task.sort_order = index
        task.list_id = listId
      }
    })
    rebuildBoardFromTasks()
    options.syncBoardPageCache()
  }

  function applyListsReordered (listIds: number[]) {
    const byId = new Map(options.lists.value.map(list => [list.listId, list]))
    const next: ListDefLike[] = []
    for (const id of listIds) {
      const list = byId.get(id)
      if (list) {
        next.push(list)
      }
    }
    for (const list of options.lists.value) {
      if (!listIds.includes(list.listId)) {
        next.push(list)
      }
    }
    options.lists.value = next as typeof options.lists.value
    rebuildBoardFromTasks()
    options.syncBoardPageCache()
  }

  function patchTaskOnBoard (
    taskId: number,
    patch: Partial<WorkspaceBoardTask>,
    options_?: { rebuild?: boolean },
  ) {
    if (!options.tasks.value) return
    const idx = options.tasks.value.findIndex(t => t.id === taskId)
    if (idx < 0) return
    const existing = options.tasks.value[idx]
    if (!existing) return
    options.tasks.value.splice(idx, 1, { ...existing, ...patch })
    if (options_?.rebuild !== false) {
      rebuildBoardFromTasks()
    }
    options.syncBoardPageCache()
  }

  return {
    rebuildBoardFromTasks,
    addTaskToBoard,
    removeTaskFromBoard,
    applyTasksReordered,
    applyListsReordered,
    patchTaskOnBoard,
  }
}
