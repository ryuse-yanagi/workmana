import { formatTaskCardEffort, formatTaskCardSingleDate } from './useTaskCardMeta'

export type WbsTaskLabel = { id: number; name: string; color: string }
export type WbsTaskMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}

export type WbsTask = {
  id: number
  title: string
  description?: string | null
  list_id: number | null
  list_name?: string | null
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  labels?: WbsTaskLabel[]
  assignees?: WbsTaskMember[]
  sort_order?: number
  is_parent_task?: boolean
  parent_task_id?: number | null
}

export type WbsDisplayRow =
  | { kind: 'parent'; task: WbsTask; childCount: number }
  | { kind: 'child'; task: WbsTask }
  | { kind: 'task'; task: WbsTask }

export function sortWbsTasks (tasks: WbsTask[]): WbsTask[] {
  return [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
}

function isOrphanChild (task: WbsTask, taskById: Map<number, WbsTask>): boolean {
  if (task.parent_task_id == null) {
    return false
  }
  const parent = taskById.get(task.parent_task_id)
  return !parent || !parent.is_parent_task
}

export function buildWbsDisplayRows (
  tasks: WbsTask[],
  collapsedParentIds: ReadonlySet<number>,
): WbsDisplayRow[] {
  const sorted = sortWbsTasks(tasks)
  const taskById = new Map(sorted.map((task) => [task.id, task]))
  const childrenByParent = new Map<number, WbsTask[]>()

  for (const task of sorted) {
    if (task.parent_task_id == null || isOrphanChild(task, taskById)) {
      continue
    }
    const siblings = childrenByParent.get(task.parent_task_id) ?? []
    siblings.push(task)
    childrenByParent.set(task.parent_task_id, siblings)
  }

  const rows: WbsDisplayRow[] = []

  for (const task of sorted) {
    if (task.parent_task_id != null && !isOrphanChild(task, taskById)) {
      continue
    }

    if (task.is_parent_task) {
      const children = childrenByParent.get(task.id) ?? []
      rows.push({ kind: 'parent', task, childCount: children.length })
      if (!collapsedParentIds.has(task.id)) {
        for (const child of children) {
          rows.push({ kind: 'child', task: child })
        }
      }
      continue
    }

    rows.push({ kind: 'task', task })
  }

  return rows
}

export function formatWbsDate (value: string | null | undefined): string {
  return formatTaskCardSingleDate(value) ?? ''
}

export function formatWbsEffort (task: WbsTask): string {
  return formatTaskCardEffort(task) ?? ''
}

export function formatWbsDescription (value: string | null | undefined): string {
  if (!value?.trim()) {
    return ''
  }
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
