import type { Ref } from 'vue'
import { sortWbsTasks, type WbsTask } from './useWbsTaskGroups'
import type { WorkspaceListOption } from './useTaskPopoverEditor'
import type { TaskFormLabel } from './useTaskFormHelpers'
import { resolveAndSortLabels } from './useLabelCategories'
import { sortMembersByDisplayName } from './useMemberDisplay'
import {
  useWorkspaceRealtimeChannel,
  type RealtimeBoardTask,
  type RealtimeWbsReorderItem,
} from './useWorkspaceRealtimeChannel'
import { resolveListColors } from '../utils/colorPresetResolution'
import { dispatchWorkspaceMembersUpdated } from './workspaceMembersUpdated'

type WbsReorderSnapshot = {
  tasks: WbsTask[]
  collapsedParentIds: Set<number>
}

export function useWbsRealtimeSync (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  editMode: MaybeRefOrGetter<boolean>
  tasks: Ref<WbsTask[]>
  workspaceLists: Ref<WorkspaceListOption[]>
  orgLabels: Ref<TaskFormLabel[]>
  reorderSnapshot: Ref<WbsReorderSnapshot | null>
  cloneWbsTasks: (source: WbsTask[]) => WbsTask[]
  persistWbsCache: () => void
  loadWbsTasks: (opts?: { silent?: boolean }) => Promise<void>
  editingTitleTaskId: Ref<number | null>
  cancelTitleEdit: () => void
}) {
  function realtimeTaskToWbsTask (task: RealtimeBoardTask): WbsTask {
    const listId = task.list_id ?? null
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      list_id: listId,
      list_name: options.workspaceLists.value.find(list => list.id === listId)?.name ?? null,
      start_date: task.start_date ?? null,
      due_date: task.due_date ?? null,
      gantt_bar_color: task.gantt_bar_color ?? null,
      effort_hours: task.effort_hours ?? null,
      progress_rate: task.progress_rate ?? null,
      labels: task.labels ? resolveAndSortLabels(task.labels, options.orgLabels.value) : [],
      assignees: sortMembersByDisplayName(task.assignees ?? []),
      sort_order: task.sort_order,
      is_parent_task: task.is_parent_task,
      parent_task_id: task.parent_task_id ?? null,
    }
  }

  function upsertRealtimeWbsTask (task: RealtimeBoardTask) {
    const next = realtimeTaskToWbsTask(task)
    const idx = options.tasks.value.findIndex(row => row.id === next.id)
    const inEditSession = toValue(options.editMode) && options.reorderSnapshot.value !== null

    if (idx >= 0) {
      // 編集セッション中はローカルの項目・並びを優先し、既存タスクの realtime 上書きで
      // 開始時スナップショットとの差分判定を壊さない
      if (inEditSession) {
        return
      }
      const current = options.tasks.value[idx]!
      options.tasks.value[idx] = {
        ...current,
        ...next,
        description: next.description ?? current.description ?? null,
        list_name: next.list_name ?? current.list_name ?? null,
        checklists: current.checklists,
      }
    } else {
      options.tasks.value = sortWbsTasks([...options.tasks.value, next])
    }
    if (options.reorderSnapshot.value) {
      const snapExists = options.reorderSnapshot.value.tasks.some(row => row.id === next.id)
      if (!snapExists) {
        // 編集中に新規追加されたタスクだけ基準へ含める（既存タスクの基準は書き換えない）
        options.reorderSnapshot.value = {
          ...options.reorderSnapshot.value,
          tasks: [...options.reorderSnapshot.value.tasks, options.cloneWbsTasks([next])[0]!],
        }
      }
    }
    options.persistWbsCache()
  }

  function removeRealtimeWbsTask (taskId: number) {
    if (!options.tasks.value.some(task => task.id === taskId)) {
      return
    }
    options.tasks.value = options.tasks.value.filter(task => task.id !== taskId)
    if (options.reorderSnapshot.value) {
      options.reorderSnapshot.value = {
        ...options.reorderSnapshot.value,
        tasks: options.reorderSnapshot.value.tasks.filter(task => task.id !== taskId),
      }
    }
    if (options.editingTitleTaskId.value === taskId) {
      options.cancelTitleEdit()
    }
    options.persistWbsCache()
  }

  function applyRealtimeWbsReorder (items: RealtimeWbsReorderItem[]) {
    if (toValue(options.editMode)) {
      return
    }
    const byId = new Map(items.map(item => [item.id, item]))
    let changed = false
    const nextTasks = options.tasks.value.map((task) => {
      const item = byId.get(task.id)
      if (!item) {
        return task
      }
      if (
        task.sort_order === item.sort_order
        && (task.parent_task_id ?? null) === item.parent_task_id
      ) {
        return task
      }
      changed = true
      return {
        ...task,
        sort_order: item.sort_order,
        parent_task_id: item.parent_task_id,
      }
    })
    if (!changed) {
      return
    }
    options.tasks.value = sortWbsTasks(nextTasks)
    options.persistWbsCache()
  }

  const workspaceIdRef = computed(() => toValue(options.workspaceId))
  useWorkspaceRealtimeChannel(workspaceIdRef, {
    onTaskCreated (task) {
      upsertRealtimeWbsTask(task)
    },
    onTaskUpdated (task) {
      upsertRealtimeWbsTask(task)
    },
    onTaskArchived ({ id, cascaded_task_ids }) {
      const removeIds = [id, ...(cascaded_task_ids ?? [])]
      for (const taskId of removeIds) {
        removeRealtimeWbsTask(taskId)
      }
    },
    onTaskRestored (task) {
      upsertRealtimeWbsTask(task)
    },
    onTaskDeleted (taskId) {
      removeRealtimeWbsTask(taskId)
    },
    onTasksReordered () {
      // ボード側の list 並び替えも sort_order を共有するため再取得
      if (toValue(options.editMode)) {
        return
      }
      void options.loadWbsTasks({ silent: true })
    },
    onWbsTasksReordered (items) {
      applyRealtimeWbsReorder(items)
    },
    onListUpdated (list) {
      const resolved = resolveListColors([{
        id: list.id,
        name: list.name,
        color_index: list.color_index,
        sort_order: list.sort_order,
      }])[0]
      const idx = options.workspaceLists.value.findIndex(row => row.id === list.id)
      if (idx >= 0) {
        options.workspaceLists.value[idx] = {
          ...options.workspaceLists.value[idx]!,
          name: list.name,
          color_index: list.color_index,
          sort_order: list.sort_order,
          color: resolved?.color ?? options.workspaceLists.value[idx]!.color,
        }
      }
      options.tasks.value = options.tasks.value.map((task) => (
        task.list_id === list.id
          ? { ...task, list_name: list.name }
          : task
      ))
      options.persistWbsCache()
    },
    onListDeleted () {
      void options.loadWbsTasks({ silent: true })
    },
    onWorkspaceMembersUpdated ({ members, removed_member_ids }) {
      dispatchWorkspaceMembersUpdated({
        orgSlug: toValue(options.orgSlug),
        workspaceId: toValue(options.workspaceId),
        members,
        removedMemberIds: removed_member_ids,
      })
    },
  })

  return {
    realtimeTaskToWbsTask,
    upsertRealtimeWbsTask,
    removeRealtimeWbsTask,
    applyRealtimeWbsReorder,
  }
}
