import type { Ref } from 'vue'
import type {
  TaskDetail,
} from '../components/modals/TaskDetailModal.vue'
import type {
  TaskHierarchyChild,
  TaskHierarchyParent,
} from '../components/task/TaskDetailHierarchyBlock.vue'
import {
  isTaskInHierarchy,
  resolveTaskHierarchyFromTasks,
  type TaskHierarchySource,
} from './useTaskHierarchy'
import {
  resolveListColor,
  resolveListName,
  type WorkspaceListOption,
} from './useTaskPopoverEditor'
import { useApi } from './useApi'

export type ParentTaskOption = { id: number; title: string }

const TASK_DETAIL_NAVIGATE_FADE_MS = 180

/**
 * タスク詳細の階層表示・親タスク選択／永続化。
 * ポップオーバー開閉（beginPopoverOpen 依存）は SFC 側に残す。
 */
export function useTaskDetailHierarchy (options: {
  task: Ref<TaskDetail | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  taskId: MaybeRefOrGetter<number | null>
  hierarchyTasks: MaybeRefOrGetter<TaskHierarchySource[] | null | undefined>
  workspaceLists: MaybeRefOrGetter<WorkspaceListOption[]>
  saving: Ref<boolean>
  activePopover: Ref<string | null>
  parentTaskLabelBtnRef: Ref<HTMLElement | null>
  isStillShowingTask: (requestTaskId: number) => boolean
  applyUpdatedTaskIfCurrent: (requestTaskId: number, updated: TaskDetail) => boolean
  armOverlayCloseGuard: (ms?: number) => void
  closePopover: () => void | Promise<void>
  updatePopoverPosition: () => void
  popoverError: Ref<string | null>
  onUpdated?: (detail: TaskDetail) => void
  onNavigate?: (taskId: number) => void
  onAddChildTask?: (payload: { parentTaskId: number; listId: number | null }) => void
}) {
  const { api } = useApi()
  const parentTasks = ref<ParentTaskOption[]>([])
  const parentTasksLoading = ref(false)
  const parentSaving = ref(false)
  const isNavigatingFade = ref(false)

  const showAddChildTaskButton = computed(() => Boolean(options.task.value?.is_parent_task))
  const showHierarchyButton = computed(() => {
    return Boolean(options.task.value?.parent_task_id || options.task.value?.is_parent_task)
  })
  const selectableParentTasks = computed(() => {
    const currentId = options.task.value?.id
    if (currentId == null) return parentTasks.value
    return parentTasks.value.filter(item => item.id !== currentId)
  })

  function toHierarchyTaskRef (detail: TaskDetail): TaskHierarchySource {
    const lists = toValue(options.workspaceLists)
    return {
      id: detail.id,
      title: detail.title,
      is_parent_task: detail.is_parent_task,
      parent_task_id: detail.parent_task_id ?? null,
      parent_task_title: detail.parent_task_id != null
        ? (detail.parent_task?.title ?? null)
        : null,
      start_date: detail.start_date ?? null,
      due_date: detail.due_date ?? null,
      effort_hours: detail.effort_hours ?? null,
      progress_rate: detail.progress_rate ?? null,
      labels: detail.labels ?? [],
      assignees: detail.assignees ?? [],
      list_id: detail.list_id,
      list_name: resolveListName(detail.list_id, lists),
      list_color: resolveListColor(detail.list_id, lists),
    }
  }

  function enrichHierarchyParent (
    parent: { id: number; title: string } | null | undefined,
  ): TaskHierarchyParent | null {
    if (!parent) {
      return null
    }
    const lists = toValue(options.workspaceLists)
    const source = hierarchyTaskSources.value.find(row => row.id === parent.id)
    const listId = source?.list_id ?? null
    return {
      id: parent.id,
      title: parent.title,
      start_date: source?.start_date ?? null,
      due_date: source?.due_date ?? null,
      effort_hours: source?.effort_hours ?? null,
      progress_rate: source?.progress_rate ?? null,
      labels: source?.labels ?? [],
      assignees: source?.assignees ?? [],
      // 階層ポップオーバーの「親タスク」欄はルート親そのものなので、親紐付け表示は出さない
      parent_task_id: null,
      parent_task_title: null,
      is_parent_task: source?.is_parent_task ?? true,
      list_id: listId,
      list_name: source?.list_name
        ?? resolveListName(listId, lists)
        ?? null,
      list_color: source?.list_color
        ?? resolveListColor(listId, lists)
        ?? null,
    }
  }

  function enrichHierarchyChild (child: TaskHierarchyChild): TaskHierarchyChild {
    const lists = toValue(options.workspaceLists)
    const source = hierarchyTaskSources.value.find(row => row.id === child.id)
    const listId = child.list_id ?? source?.list_id ?? null
    return {
      id: child.id,
      title: child.title,
      start_date: child.start_date ?? source?.start_date ?? null,
      due_date: child.due_date ?? source?.due_date ?? null,
      effort_hours: child.effort_hours ?? source?.effort_hours ?? null,
      progress_rate: child.progress_rate ?? source?.progress_rate ?? null,
      labels: child.labels?.length ? child.labels : (source?.labels ?? []),
      assignees: child.assignees?.length ? child.assignees : (source?.assignees ?? []),
      parent_task_id: child.parent_task_id ?? source?.parent_task_id ?? null,
      parent_task_title: child.parent_task_title ?? source?.parent_task_title ?? null,
      is_parent_task: child.is_parent_task ?? source?.is_parent_task ?? false,
      list_id: listId,
      list_name: child.list_name
        ?? source?.list_name
        ?? resolveListName(listId, lists)
        ?? null,
      list_color: child.list_color
        ?? source?.list_color
        ?? resolveListColor(listId, lists)
        ?? null,
    }
  }

  const hierarchyTaskSources = computed((): TaskHierarchySource[] => {
    const base = toValue(options.hierarchyTasks) ?? []
    const current = options.task.value
    if (!current) {
      return base
    }
    const currentSource = toHierarchyTaskRef(current)
    const index = base.findIndex(row => row.id === current.id)
    if (index < 0) {
      return [...base, currentSource]
    }
    const next = base.slice()
    next[index] = { ...base[index]!, ...currentSource }
    return next
  })

  const resolvedHierarchy = computed((): {
    parent_task: TaskHierarchyParent | null
    child_tasks: TaskHierarchyChild[]
  } => {
    const current = options.task.value
    if (!current || !isTaskInHierarchy(current)) {
      return { parent_task: null, child_tasks: [] }
    }
    const lists = toValue(options.workspaceLists)
    const resolveName = (listId: number | null) => resolveListName(listId, lists)
    if (hierarchyTaskSources.value.length > 0) {
      const resolved = resolveTaskHierarchyFromTasks(
        toHierarchyTaskRef(current),
        hierarchyTaskSources.value,
        resolveName,
      )
      if (resolved.parent_task) {
        return {
          parent_task: enrichHierarchyParent(resolved.parent_task),
          child_tasks: resolved.child_tasks.map(enrichHierarchyChild),
        }
      }
      if (current.parent_task_id != null) {
        const parent = parentTasks.value.find(item => item.id === current.parent_task_id)
        return {
          parent_task: enrichHierarchyParent(parent ?? null),
          child_tasks: resolved.child_tasks.map(enrichHierarchyChild),
        }
      }
      return {
        parent_task: null,
        child_tasks: resolved.child_tasks.map(enrichHierarchyChild),
      }
    }
    if (current.parent_task) {
      return {
        parent_task: enrichHierarchyParent(current.parent_task),
        child_tasks: (current.child_tasks ?? []).map(enrichHierarchyChild),
      }
    }
    if (current.is_parent_task) {
      return {
        parent_task: enrichHierarchyParent({
          id: current.id,
          title: current.title,
        }),
        child_tasks: (current.child_tasks ?? []).map(enrichHierarchyChild),
      }
    }
    if (current.parent_task_id != null) {
      const parent = parentTasks.value.find(item => item.id === current.parent_task_id)
      return {
        parent_task: enrichHierarchyParent(parent ?? null),
        child_tasks: (current.child_tasks ?? []).map(enrichHierarchyChild),
      }
    }
    return { parent_task: null, child_tasks: [] }
  })

  const hierarchyParent = computed((): TaskHierarchyParent | null => {
    return resolvedHierarchy.value.parent_task
  })
  const hierarchyChildTasks = computed((): TaskHierarchyChild[] => {
    return resolvedHierarchy.value.child_tasks
  })
  const parentTaskDisplayLabel = computed(() => {
    if (!options.task.value?.parent_task_id) {
      return '未設定'
    }
    if (hierarchyParent.value?.title) {
      return hierarchyParent.value.title
    }
    if (options.task.value.parent_task?.title) {
      return options.task.value.parent_task.title
    }
    const parent = parentTasks.value.find(item => item.id === options.task.value!.parent_task_id)
    return parent?.title ?? '未設定'
  })
  /** 親タスクになり得る通常タスクのみ。ルート親（is_parent_task）は階層UI側で扱う */
  const showParentTaskLabel = computed(() => {
    return Boolean(options.task.value && !options.task.value.is_parent_task)
  })

  async function fetchParentTasks () {
    parentTasksLoading.value = true
    try {
      const res = await api<{ data: ParentTaskOption[] }>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/parents`,
      )
      parentTasks.value = res.data ?? []
    } catch {
      parentTasks.value = []
    } finally {
      parentTasksLoading.value = false
    }
  }

  async function onHierarchyTaskSelect (taskId: number) {
    if (!options.task.value || isNavigatingFade.value) {
      return
    }
    if (options.activePopover.value) {
      await options.closePopover()
    }
    isNavigatingFade.value = true
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, TASK_DETAIL_NAVIGATE_FADE_MS)
    })
    if (options.task.value.id !== taskId) {
      options.onNavigate?.(taskId)
    }
    await nextTick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isNavigatingFade.value = false
      })
    })
  }

  function onAddChildTask () {
    if (!options.task.value?.is_parent_task || options.saving.value) return
    void options.closePopover()
    options.onAddChildTask?.({
      parentTaskId: options.task.value.id,
      listId: options.task.value.list_id ?? null,
    })
  }

  async function persistParentTaskId (parentTaskId: number | null) {
    if (!options.task.value || parentSaving.value || options.saving.value) return
    if ((options.task.value.parent_task_id ?? null) === parentTaskId) {
      return
    }
    const requestTaskId = options.task.value.id
    options.armOverlayCloseGuard()
    parentSaving.value = true
    options.popoverError.value = null
    const previousParentTaskId = options.task.value.parent_task_id ?? null
    const previousParentTask = options.task.value.parent_task ?? null
    const previousIsParentTask = Boolean(options.task.value.is_parent_task)
    const selectedParent = parentTaskId != null
      ? selectableParentTasks.value.find(item => item.id === parentTaskId) ?? null
      : null
    options.task.value = {
      ...options.task.value,
      parent_task_id: parentTaskId,
      parent_task: selectedParent
        ? { id: selectedParent.id, title: selectedParent.title }
        : null,
      is_parent_task: false,
    }
    await nextTick()
    if (options.activePopover.value === 'parent-task') {
      options.parentTaskLabelBtnRef.value = options.parentTaskLabelBtnRef.value
      options.updatePopoverPosition()
    }
    // Re-anchor after optimistic update when parent-task popover is open
    if (options.activePopover.value === 'parent-task') {
      // popoverAnchorEl is owned by SFC; updatePopoverPosition reads it there
      options.updatePopoverPosition()
    }
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { parent_task_id: parentTaskId } },
      )
      if (!options.applyUpdatedTaskIfCurrent(requestTaskId, updated)) return
      options.onUpdated?.(options.task.value)
      await nextTick()
      if (options.activePopover.value === 'parent-task') {
        options.updatePopoverPosition()
      }
    } catch (e: unknown) {
      if (!options.isStillShowingTask(requestTaskId)) return
      options.task.value = {
        ...options.task.value,
        parent_task_id: previousParentTaskId,
        parent_task: previousParentTask,
        is_parent_task: previousIsParentTask,
      }
      options.popoverError.value = e instanceof Error ? e.message : '親タスクの更新に失敗しました'
    } finally {
      if (options.isStillShowingTask(requestTaskId) || toValue(options.taskId) === requestTaskId) {
        parentSaving.value = false
      }
    }
  }

  function selectParentTask (parentTaskId: number) {
    void persistParentTaskId(parentTaskId)
  }

  function clearParentTask () {
    void persistParentTaskId(null)
  }

  return {
    parentTasks,
    parentTasksLoading,
    parentSaving,
    isNavigatingFade,
    showAddChildTaskButton,
    showHierarchyButton,
    selectableParentTasks,
    hierarchyTaskSources,
    resolvedHierarchy,
    hierarchyParent,
    hierarchyChildTasks,
    parentTaskDisplayLabel,
    showParentTaskLabel,
    toHierarchyTaskRef,
    enrichHierarchyParent,
    enrichHierarchyChild,
    fetchParentTasks,
    onHierarchyTaskSelect,
    onAddChildTask,
    persistParentTaskId,
    selectParentTask,
    clearParentTask,
  }
}
