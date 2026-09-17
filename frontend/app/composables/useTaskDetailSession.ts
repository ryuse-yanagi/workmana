import type { Ref } from 'vue'
import type { TaskDetail } from '../components/modals/TaskDetailModal.vue'
import { resolveAndSortLabels } from './useLabelCategories'
import { sortMembersByDisplayName } from './useMemberDisplay'
import type { TaskFormLabel } from './useTaskFormHelpers'

/**
 * タスク詳細モーダルで共有する「現在表示中のタスク」判定と正規化。
 */
export function useTaskDetailSession (options: {
  task: Ref<TaskDetail | null>
  taskId: MaybeRefOrGetter<number | null>
  orgLabels: MaybeRefOrGetter<TaskFormLabel[]>
}) {
  function isStillShowingTask (requestTaskId: number): boolean {
    return toValue(options.taskId) === requestTaskId && options.task.value?.id === requestTaskId
  }

  function normalizeTaskDetail (detail: TaskDetail): TaskDetail {
    return {
      ...detail,
      labels: resolveAndSortLabels(detail.labels, toValue(options.orgLabels)),
      assignees: sortMembersByDisplayName(detail.assignees ?? []),
      checklists: detail.checklists ?? [],
      parent_task: detail.parent_task ?? null,
      child_tasks: detail.child_tasks ?? [],
    }
  }

  function applyUpdatedTaskIfCurrent (requestTaskId: number, updated: TaskDetail): boolean {
    if (!isStillShowingTask(requestTaskId)) {
      return false
    }
    options.task.value = normalizeTaskDetail(updated)
    return true
  }

  return {
    isStillShowingTask,
    normalizeTaskDetail,
    applyUpdatedTaskIfCurrent,
  }
}
