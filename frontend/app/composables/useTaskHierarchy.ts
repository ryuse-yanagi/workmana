import type {
  TaskHierarchyChild,
  TaskHierarchyParent,
} from '../components/task/TaskDetailHierarchyBlock.vue'
export type TaskHierarchySource = {
  id: number
  title: string
  is_parent_task?: boolean
  parent_task_id?: number | null
  due_date?: string | null
  list_id?: number | null
  list_name?: string | null
  sort_order?: number
}
export function isTaskInHierarchy (task: TaskHierarchySource | null | undefined): boolean {
  if (!task) {
    return false
  }
  return Boolean(task.is_parent_task || task.parent_task_id != null)
}
function compareHierarchyTasks (a: TaskHierarchySource, b: TaskHierarchySource): number {
  const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
  if (orderDiff !== 0) {
    return orderDiff
  }
  return a.id - b.id
}
function toHierarchyChild (
  task: TaskHierarchySource,
  resolveListName?: (listId: number | null) => string | null,
): TaskHierarchyChild {
  return {
    id: task.id,
    title: task.title,
    due_date: task.due_date ?? null,
    list_name: task.list_name ?? resolveListName?.(task.list_id ?? null) ?? null,
  }
}
export function resolveTaskHierarchyFromTasks<T extends TaskHierarchySource> (
  task: T,
  allTasks: T[],
  resolveListName?: (listId: number | null) => string | null,
): { parent_task: TaskHierarchyParent | null; child_tasks: TaskHierarchyChild[] } {
  if (task.is_parent_task) {
    const childTasks = allTasks
      .filter(row => row.parent_task_id === task.id)
      .sort(compareHierarchyTasks)
      .map(row => toHierarchyChild(row, resolveListName))
    return {
      parent_task: { id: task.id, title: task.title },
      child_tasks: childTasks,
    }
  }
  if (task.parent_task_id != null) {
    const parent = allTasks.find(row => row.id === task.parent_task_id) ?? null
    const childTasks = allTasks
      .filter(row => row.parent_task_id === task.parent_task_id)
      .sort(compareHierarchyTasks)
      .map(row => toHierarchyChild(row, resolveListName))
    return {
      parent_task: parent ? { id: parent.id, title: parent.title } : null,
      child_tasks: childTasks,
    }
  }
  return {
    parent_task: null,
    child_tasks: [],
  }
}
export function enrichTaskDetailHierarchy<D extends TaskHierarchySource> (
  detail: D & { parent_task?: TaskHierarchyParent | null; child_tasks?: TaskHierarchyChild[] },
  allTasks: TaskHierarchySource[],
  resolveListName?: (listId: number | null) => string | null,
): D & { parent_task: TaskHierarchyParent | null; child_tasks: TaskHierarchyChild[] } {
  if (!isTaskInHierarchy(detail)) {
    return {
      ...detail,
      parent_task: detail.parent_task ?? null,
      child_tasks: detail.child_tasks ?? [],
    }
  }
  const resolved = resolveTaskHierarchyFromTasks(detail, allTasks, resolveListName)
  return {
    ...detail,
    parent_task: detail.parent_task ?? resolved.parent_task,
    child_tasks: detail.child_tasks?.length ? detail.child_tasks : resolved.child_tasks,
  } as D & { parent_task: TaskHierarchyParent | null; child_tasks: TaskHierarchyChild[] }
}
