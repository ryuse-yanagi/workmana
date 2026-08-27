import { formatTaskCardEffort, formatTaskCardSingleDate } from './useTaskCardMeta'
import type { TaskChecklist } from '../components/task/TaskDetailChecklistBlock.vue'
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
  created_at?: string | null
  list_id: number | null
  list_name?: string | null
  start_date?: string | null
  due_date?: string | null
  gantt_bar_color?: string | null
  effort_hours?: number | string | null
  labels?: WbsTaskLabel[]
  assignees?: WbsTaskMember[]
  checklists?: TaskChecklist[]
  sort_order?: number
  is_parent_task?: boolean
  parent_task_id?: number | null
}
export type WbsDisplayRow =
  | { kind: 'parent'; task: WbsTask; childCount: number }
  | { kind: 'child'; task: WbsTask }
  | { kind: 'task'; task: WbsTask }
export function sortWbsTasks (tasks: WbsTask[]): WbsTask[] {
  return [...tasks].sort((a, b) => (
    (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || a.id - b.id
  ))
}
export type WbsReorderItem = {
  id: number
  sort_order: number
  parent_task_id: number | null
}
export function buildFullWbsDisplayRows (tasks: WbsTask[]): WbsDisplayRow[] {
  return buildWbsDisplayRows(tasks, new Set())
}
export function isTopLevelDropIndex (rows: WbsDisplayRow[], index: number): boolean {
  if (index <= 0 || index >= rows.length) {
    return true
  }
  return rows[index]!.kind !== 'child'
}
/** 子タスクを、元の親タスク配下の挿入範囲に収める（別親への移動を防ぐ） */
function clampChildInsertIndex (
  rows: WbsDisplayRow[],
  block: WbsDisplayRow[],
  insertAt: number,
): number {
  const dragged = block[0]
  if (!dragged || dragged.kind !== 'child') {
    return insertAt
  }
  const parentId = dragged.task.parent_task_id
  if (parentId == null) {
    return insertAt
  }
  const parentIndex = rows.findIndex(
    row => row.kind === 'parent' && row.task.id === parentId,
  )
  if (parentIndex < 0) {
    return insertAt
  }
  let rangeEnd = parentIndex + 1
  while (
    rangeEnd < rows.length
    && rows[rangeEnd]!.kind === 'child'
    && rows[rangeEnd]!.task.parent_task_id === parentId
  ) {
    rangeEnd += 1
  }
  return Math.max(parentIndex + 1, Math.min(insertAt, rangeEnd))
}
export function mapCollapsedTargetToFullIndex (
  collapsedRows: WbsDisplayRow[],
  fullRows: WbsDisplayRow[],
  targetIndex: number,
): number {
  if (targetIndex >= collapsedRows.length) {
    return fullRows.length
  }
  const anchorRow = collapsedRows[targetIndex]!
  const fullIndex = fullRows.findIndex(row => row.task.id === anchorRow.task.id)
  return fullIndex >= 0 ? fullIndex : fullRows.length
}
export function getWbsDragBlock (
  rows: WbsDisplayRow[],
  rowIndex: number,
  tasks: WbsTask[] = [],
  collapsedParentIds: ReadonlySet<number> = new Set(),
): { block: WbsDisplayRow[]; indices: number[] } {
  const row = rows[rowIndex]
  if (!row) {
    return { block: [], indices: [] }
  }
  if (row.kind === 'child' || row.kind === 'task') {
    const index = rows.findIndex(item => item.task.id === row.task.id)
    return { block: [row], indices: index >= 0 ? [index] : [] }
  }
  const childTasks = sortWbsTasks(tasks.filter(task => task.parent_task_id === row.task.id))
  const isCollapsed = collapsedParentIds.has(row.task.id)
  const block: WbsDisplayRow[] = isCollapsed
    ? [row]
    : [
        row,
        ...childTasks.map(task => ({ kind: 'child' as const, task })),
      ]
  const indices = block
    .map(item => rows.findIndex(existing => existing.task.id === item.task.id))
    .filter(index => index >= 0)
  return { block, indices }
}
function countRowsBeforeIndex (
  rows: WbsDisplayRow[],
  index: number,
  excludeTaskIds: Set<number>,
): number {
  let count = 0
  const clampedIndex = Math.max(0, Math.min(index, rows.length))
  for (let i = 0; i < clampedIndex; i++) {
    if (!excludeTaskIds.has(rows[i]!.task.id)) {
      count++
    }
  }
  return count
}
export function snapToTopLevelDropIndex (
  rows: WbsDisplayRow[],
  insertAt: number,
): number {
  if (isTopLevelDropIndex(rows, insertAt)) {
    return insertAt
  }
  for (let index = insertAt; index <= rows.length; index++) {
    if (isTopLevelDropIndex(rows, index)) {
      return index
    }
  }
  for (let index = insertAt - 1; index >= 0; index--) {
    if (isTopLevelDropIndex(rows, index)) {
      return index
    }
  }
  return rows.length
}
export function moveWbsDisplayRows (
  rows: WbsDisplayRow[],
  sourceIndex: number,
  targetIndex: number,
  tasks: WbsTask[] = [],
  collapsedParentIds: ReadonlySet<number> = new Set(),
): WbsDisplayRow[] | null {
  const { block } = getWbsDragBlock(rows, sourceIndex, tasks, collapsedParentIds)
  if (!block.length) {
    return null
  }
  const blockTaskIds = new Set(block.map(item => item.task.id))
  const without = rows.filter(item => !blockTaskIds.has(item.task.id))
  const isParentBlock = block[0]!.kind === 'parent'
  let insertAt = countRowsBeforeIndex(rows, targetIndex, blockTaskIds)
  insertAt = Math.max(0, Math.min(insertAt, without.length))
  if (isParentBlock) {
    insertAt = snapToTopLevelDropIndex(without, insertAt)
  } else {
    insertAt = clampChildInsertIndex(without, block, insertAt)
  }
  const sourceInsertAt = countRowsBeforeIndex(rows, sourceIndex, blockTaskIds)
  if (insertAt === sourceInsertAt) {
    return rows
  }
  return [
    ...without.slice(0, insertAt),
    ...block,
    ...without.slice(insertAt),
  ]
}
/** ドラッグ中のゴースト・配置プレビューに表示する行（折りたたみ状態を維持） */
export function getWbsDragGhostBlock (block: WbsDisplayRow[]): WbsDisplayRow[] {
  return block
}
export function previewWbsDragInsert (
  rows: WbsDisplayRow[],
  ghostBlock: WbsDisplayRow[],
  targetIndex: number,
): WbsDisplayRow[] {
  if (!ghostBlock.length) {
    return rows
  }
  const blockTaskIds = new Set(ghostBlock.map(item => item.task.id))
  const without = rows.filter(item => !blockTaskIds.has(item.task.id))
  const isParentBlock = ghostBlock[0]!.kind === 'parent'
  let insertAt = countRowsBeforeIndex(rows, targetIndex, blockTaskIds)
  insertAt = Math.max(0, Math.min(insertAt, without.length))
  if (isParentBlock) {
    insertAt = snapToTopLevelDropIndex(without, insertAt)
  } else {
    insertAt = clampChildInsertIndex(without, ghostBlock, insertAt)
  }
  return [
    ...without.slice(0, insertAt),
    ...ghostBlock,
    ...without.slice(insertAt),
  ]
}
export function resolveWbsDropIndexFromDom (
  clientX: number,
  clientY: number,
  tbody: HTMLElement,
  baseRows: WbsDisplayRow[],
  excludeTaskIds: ReadonlySet<number>,
): number {
  const rowEls = tbody.querySelectorAll<HTMLElement>('[data-wbs-task-id]')
  const hitEl = document.elementFromPoint(clientX, clientY)
  const hitRowEl = hitEl?.closest<HTMLElement>('[data-wbs-task-id]')
  if (hitRowEl && tbody.contains(hitRowEl)) {
    const taskId = Number(hitRowEl.dataset.wbsTaskId)
    if (!excludeTaskIds.has(taskId)) {
      const baseIndex = baseRows.findIndex(row => row.task.id === taskId)
      if (baseIndex >= 0) {
        return baseIndex
      }
    }
  }
  for (const rowEl of rowEls) {
    const taskId = Number(rowEl.dataset.wbsTaskId)
    if (excludeTaskIds.has(taskId)) {
      continue
    }
    const rect = rowEl.getBoundingClientRect()
    if (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    ) {
      const baseIndex = baseRows.findIndex(row => row.task.id === taskId)
      if (baseIndex >= 0) {
        return baseIndex
      }
    }
  }
  if (rowEls.length > 0) {
    const firstEl = rowEls[0]!
    const firstRect = firstEl.getBoundingClientRect()
    if (clientY < firstRect.top) {
      const firstTaskId = Number(firstEl.dataset.wbsTaskId)
      if (!excludeTaskIds.has(firstTaskId)) {
        return 0
      }
    }
    const lastEl = rowEls[rowEls.length - 1]!
    const lastRect = lastEl.getBoundingClientRect()
    if (clientY > lastRect.bottom) {
      return baseRows.length
    }
  }
  let nearestIndex = baseRows.length
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const rowEl of rowEls) {
    const taskId = Number(rowEl.dataset.wbsTaskId)
    if (excludeTaskIds.has(taskId)) {
      continue
    }
    const rect = rowEl.getBoundingClientRect()
    const distance = Math.abs(clientY - (rect.top + rect.height / 2))
    if (distance < nearestDistance) {
      const baseIndex = baseRows.findIndex(row => row.task.id === taskId)
      if (baseIndex >= 0) {
        nearestDistance = distance
        nearestIndex = baseIndex
      }
    }
  }
  return nearestIndex
}
export function resolveParentIdForChildAt (
  rows: WbsDisplayRow[],
  childIndex: number,
): number | null {
  for (let index = childIndex - 1; index >= 0; index--) {
    const row = rows[index]!
    if (row.kind === 'parent') {
      return row.task.id
    }
    if (row.kind === 'child') {
      return row.task.parent_task_id ?? null
    }
    if (row.kind === 'task') {
      return null
    }
  }
  return null
}
export function applyWbsRowOrder (
  tasks: WbsTask[],
  rows: WbsDisplayRow[],
  reparentedChildIds?: ReadonlySet<number>,
): WbsTask[] {
  const taskById = new Map(tasks.map(task => [task.id, { ...task }]))
  let sortOrder = 0
  rows.forEach((row, index) => {
    const task = taskById.get(row.task.id)
    if (!task) {
      return
    }
    task.sort_order = sortOrder
    sortOrder += 1
    if (row.kind === 'task') {
      // 親なしWBSの行は、参照先が壊れた親IDを持っていても常に親なしへ揃える
      task.parent_task_id = null
      return
    }
    if (reparentedChildIds?.has(row.task.id)) {
      task.is_parent_task = false
      task.parent_task_id = resolveParentIdForChildAt(rows, index)
    }
  })
  return Array.from(taskById.values())
}
export function buildWbsReorderPayload (tasks: WbsTask[]): WbsReorderItem[] {
  return sortWbsTasks(tasks).map((task, index) => ({
    id: task.id,
    sort_order: task.sort_order ?? index,
    parent_task_id: task.parent_task_id ?? null,
  }))
}
function isDanglingChild (task: WbsTask, taskById: Map<number, WbsTask>): boolean {
  if (task.parent_task_id == null) {
    return false
  }
  const parent = taskById.get(task.parent_task_id)
  return !parent || !parent.is_parent_task
}
function collectStandaloneTasks (tasks: WbsTask[], taskById: Map<number, WbsTask>): WbsTask[] {
  const standaloneTasks: WbsTask[] = []
  for (const task of sortWbsTasks(tasks)) {
    if (task.parent_task_id != null && !isDanglingChild(task, taskById)) {
      continue
    }
    if (task.is_parent_task) {
      continue
    }
    standaloneTasks.push(task)
  }
  return standaloneTasks
}
function buildParentSegmentRows (
  parentTask: WbsTask,
  children: WbsTask[],
  collapsedParentIds: ReadonlySet<number>,
): WbsDisplayRow[] {
  const rows: WbsDisplayRow[] = [{
    kind: 'parent',
    task: parentTask,
    childCount: children.length,
  }]
  if (!collapsedParentIds.has(parentTask.id)) {
    for (const child of children) {
      rows.push({ kind: 'child', task: child })
    }
  }
  return rows
}
/** 親タスクとその子タスクだけで構成される、上段WBSの行 */
export function buildWbsDisplayRows (
  tasks: WbsTask[],
  collapsedParentIds: ReadonlySet<number>,
): WbsDisplayRow[] {
  const sorted = sortWbsTasks(tasks)
  const taskById = new Map(sorted.map((task) => [task.id, task]))
  const childrenByParent = new Map<number, WbsTask[]>()
  for (const task of sorted) {
    if (task.parent_task_id == null || isDanglingChild(task, taskById)) {
      continue
    }
    const siblings = childrenByParent.get(task.parent_task_id) ?? []
    siblings.push(task)
    childrenByParent.set(task.parent_task_id, siblings)
  }
  const rows: WbsDisplayRow[] = []
  for (const task of sorted) {
    if (!task.is_parent_task) {
      continue
    }
    // 他の親タスクの子として既に描画される親タスクは、見出し行を重複させない
    if (task.parent_task_id != null && !isDanglingChild(task, taskById)) {
      continue
    }
    const children = childrenByParent.get(task.id) ?? []
    rows.push(...buildParentSegmentRows(task, children, collapsedParentIds))
  }
  return rows
}
/** 親を持たないタスクだけで構成される、下段WBSの行 */
export function buildStandaloneWbsDisplayRows (tasks: WbsTask[]): WbsDisplayRow[] {
  const sorted = sortWbsTasks(tasks)
  const taskById = new Map(sorted.map((task) => [task.id, task]))
  return collectStandaloneTasks(sorted, taskById).map(task => ({ kind: 'task' as const, task }))
}
const WBS_WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
export function formatWbsDate (value: string | null | undefined): string {
  const formatted = formatTaskCardSingleDate(value)
  if (!formatted) {
    return ''
  }
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return formatted
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const weekday = WBS_WEEKDAY_LABELS[date.getDay()]
  if (!weekday) {
    return formatted
  }
  const yearMatch = formatted.match(/^(\d{2}\/\d{2})( \(\d{4}\))?$/)
  if (!yearMatch) {
    return `${formatted}（${weekday}）`
  }
  return `${yearMatch[1]}（${weekday}）${yearMatch[2] ?? ''}`
}
export function formatWbsEffort (task: WbsTask): string {
  return formatTaskCardEffort(task) ?? ''
}
/** WBSの説明列は 1 行目のみ表示し、続きがあれば省略記号を付ける */
export function formatWbsDescription (value: string | null | undefined): string {
  if (!value?.trim()) {
    return ''
  }
  const lines = value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .split(/\r?\n/)
  const firstIndex = lines.findIndex(line => line.trim() !== '')
  if (firstIndex < 0) {
    return ''
  }
  const firstLine = lines[firstIndex]!.replace(/\s+/g, ' ').trim()
  const hasMore = lines.slice(firstIndex + 1).some(line => line.trim() !== '')
  return hasMore ? `${firstLine}...` : firstLine
}
