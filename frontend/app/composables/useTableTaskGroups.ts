import { formatTaskCardEffort, formatTaskCardSingleDate } from './useTaskCardMeta'
import type { TaskChecklist } from '../components/task/TaskDetailChecklistBlock.vue'
export type TableTaskLabel = { id: number; name: string; color: string }
export type TableTaskMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
export type TableTask = {
  id: number
  title: string
  description?: string | null
  created_at?: string | null
  status?: string
  list_id: number | null
  list_name?: string | null
  start_date?: string | null
  due_date?: string | null
  gantt_bar_color?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  labels?: TableTaskLabel[]
  assignees?: TableTaskMember[]
  checklist?: TaskChecklist | null
  sort_order?: number
  is_parent_task?: boolean
  parent_task_id?: number | null
}
export const ORPHAN_PARENT_TASK_ID = -1
export const ORPHAN_PARENT_DEFAULT_LABEL = '親タスクなし'
export type TableDisplayRow =
  | { kind: 'parent'; task: TableTask; childCount: number }
  | { kind: 'child'; task: TableTask }
  | { kind: 'task'; task: TableTask }
export function isTableOrphanParentTask (task: Pick<TableTask, 'id'>): boolean {
  return task.id === ORPHAN_PARENT_TASK_ID
}
export function createTableOrphanParentTask (
  label: string = ORPHAN_PARENT_DEFAULT_LABEL,
): TableTask {
  const title = label.trim() || ORPHAN_PARENT_DEFAULT_LABEL
  return {
    id: ORPHAN_PARENT_TASK_ID,
    title,
    list_id: null,
    is_parent_task: true,
  }
}
export function sortTableTasks (tasks: TableTask[]): TableTask[] {
  return [...tasks].sort((a, b) => (
    (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || a.id - b.id
  ))
}
export type TableReorderItem = {
  id: number
  sort_order: number
  parent_task_id: number | null
}
export function buildFullTableDisplayRows (
  tasks: TableTask[],
  orphanParentLabel: string = ORPHAN_PARENT_DEFAULT_LABEL,
  orphanParentSortOrder: number | null = null,
): TableDisplayRow[] {
  return buildTableDisplayRows(tasks, new Set(), orphanParentLabel, orphanParentSortOrder)
}
export function isTopLevelDropIndex (rows: TableDisplayRow[], index: number): boolean {
  if (index <= 0 || index >= rows.length) {
    return true
  }
  return rows[index]!.kind !== 'child'
}
function getFirstRealParentRowIndex (rows: TableDisplayRow[]): number {
  return rows.findIndex(row => row.kind === 'parent' && !isTableOrphanParentTask(row.task))
}
function clampChildInsertIndex (
  rows: TableDisplayRow[],
  block: TableDisplayRow[],
  insertAt: number,
): number {
  const draggedKind = block[0]?.kind
  if (draggedKind !== 'child') {
    return insertAt
  }
  const firstParentIndex = getFirstRealParentRowIndex(rows)
  if (firstParentIndex < 0) {
    return insertAt
  }
  return Math.max(insertAt, firstParentIndex + 1)
}
export function mapCollapsedTargetToFullIndex (
  collapsedRows: TableDisplayRow[],
  fullRows: TableDisplayRow[],
  targetIndex: number,
): number {
  if (targetIndex >= collapsedRows.length) {
    return fullRows.length
  }
  const anchorRow = collapsedRows[targetIndex]!
  const fullIndex = fullRows.findIndex(row => row.task.id === anchorRow.task.id)
  return fullIndex >= 0 ? fullIndex : fullRows.length
}
export function getTableDragBlock (
  rows: TableDisplayRow[],
  rowIndex: number,
  tasks: TableTask[] = [],
  collapsedParentIds: ReadonlySet<number> = new Set(),
): { block: TableDisplayRow[]; indices: number[] } {
  const row = rows[rowIndex]
  if (!row) {
    return { block: [], indices: [] }
  }
  if (row.kind === 'child' || row.kind === 'task') {
    const index = rows.findIndex(item => item.task.id === row.task.id)
    return { block: [row], indices: index >= 0 ? [index] : [] }
  }
  if (isTableOrphanParentTask(row.task)) {
    const sorted = sortTableTasks(tasks)
    const taskById = new Map(sorted.map(task => [task.id, task]))
    const orphanTasks = collectOrphanTasks(sorted, taskById)
    const isCollapsed = collapsedParentIds.has(row.task.id)
    const block: TableDisplayRow[] = isCollapsed
      ? [row]
      : [
          row,
          ...orphanTasks.map(task => ({ kind: 'child' as const, task })),
        ]
    const indices = block
      .map(item => rows.findIndex(existing => existing.task.id === item.task.id))
      .filter(index => index >= 0)
    return { block, indices }
  }
  const childTasks = sortTableTasks(tasks.filter(task => task.parent_task_id === row.task.id))
  const isCollapsed = collapsedParentIds.has(row.task.id)
  const block: TableDisplayRow[] = isCollapsed
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
  rows: TableDisplayRow[],
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
  rows: TableDisplayRow[],
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
export function moveTableDisplayRows (
  rows: TableDisplayRow[],
  sourceIndex: number,
  targetIndex: number,
  tasks: TableTask[] = [],
  collapsedParentIds: ReadonlySet<number> = new Set(),
): TableDisplayRow[] | null {
  const { block } = getTableDragBlock(rows, sourceIndex, tasks, collapsedParentIds)
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
export function getTableDragGhostBlock (block: TableDisplayRow[]): TableDisplayRow[] {
  return block
}
export function previewTableDragInsert (
  rows: TableDisplayRow[],
  ghostBlock: TableDisplayRow[],
  targetIndex: number,
): TableDisplayRow[] {
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
export function resolveTableDropIndexFromDom (
  clientX: number,
  clientY: number,
  tbody: HTMLElement,
  baseRows: TableDisplayRow[],
  excludeTaskIds: ReadonlySet<number>,
): number {
  const rowEls = tbody.querySelectorAll<HTMLElement>('[data-table-task-id]')
  const hitEl = document.elementFromPoint(clientX, clientY)
  const hitRowEl = hitEl?.closest<HTMLElement>('[data-table-task-id]')
  if (hitRowEl && tbody.contains(hitRowEl)) {
    const taskId = Number(hitRowEl.dataset.tableTaskId)
    if (!excludeTaskIds.has(taskId)) {
      const baseIndex = baseRows.findIndex(row => row.task.id === taskId)
      if (baseIndex >= 0) {
        return baseIndex
      }
    }
  }
  for (const rowEl of rowEls) {
    const taskId = Number(rowEl.dataset.tableTaskId)
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
      const firstTaskId = Number(firstEl.dataset.tableTaskId)
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
    const taskId = Number(rowEl.dataset.tableTaskId)
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
  rows: TableDisplayRow[],
  childIndex: number,
): number | null {
  for (let index = childIndex - 1; index >= 0; index--) {
    const row = rows[index]!
    if (row.kind === 'parent') {
      return isTableOrphanParentTask(row.task) ? null : row.task.id
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
export function applyTableRowOrder (
  tasks: TableTask[],
  rows: TableDisplayRow[],
  reparentedChildIds?: ReadonlySet<number>,
): TableTask[] {
  const taskById = new Map(tasks.map(task => [task.id, { ...task }]))
  let sortOrder = 0
  rows.forEach((row, index) => {
    if (isTableOrphanParentTask(row.task)) {
      return
    }
    const task = taskById.get(row.task.id)
    if (!task) {
      return
    }
    task.sort_order = sortOrder
    sortOrder += 1
    if (reparentedChildIds?.has(row.task.id)) {
      task.is_parent_task = false
      task.parent_task_id = resolveParentIdForChildAt(rows, index)
    }
  })
  return Array.from(taskById.values())
}
export function buildTableReorderPayload (tasks: TableTask[]): TableReorderItem[] {
  return sortTableTasks(tasks.filter(task => !isTableOrphanParentTask(task))).map((task, index) => ({
    id: task.id,
    sort_order: task.sort_order ?? index,
    parent_task_id: task.parent_task_id ?? null,
  }))
}
function isOrphanChild (task: TableTask, taskById: Map<number, TableTask>): boolean {
  if (task.parent_task_id == null) {
    return false
  }
  const parent = taskById.get(task.parent_task_id)
  return !parent || !parent.is_parent_task
}
function collectOrphanTasks (tasks: TableTask[], taskById: Map<number, TableTask>): TableTask[] {
  const orphanTasks: TableTask[] = []
  for (const task of sortTableTasks(tasks)) {
    if (task.parent_task_id != null && !isOrphanChild(task, taskById)) {
      continue
    }
    if (task.is_parent_task) {
      continue
    }
    orphanTasks.push(task)
  }
  return orphanTasks
}
function buildParentSegmentRows (
  parentTask: TableTask,
  children: TableTask[],
  collapsedParentIds: ReadonlySet<number>,
): TableDisplayRow[] {
  const rows: TableDisplayRow[] = [{
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
function resolveOrphanSegmentAnchor (
  orphanTasks: TableTask[],
  orphanParentSortOrder: number | null | undefined,
): number {
  if (orphanTasks.length > 0) {
    return Math.min(...orphanTasks.map(task => task.sort_order ?? 0))
  }
  if (orphanParentSortOrder == null) {
    return Number.MAX_SAFE_INTEGER
  }
  return orphanParentSortOrder
}
export function resolveOrphanParentSortOrderFromRows (
  rows: TableDisplayRow[],
  tasks: TableTask[],
): number | null {
  const orphanIndex = rows.findIndex(
    row => row.kind === 'parent' && isTableOrphanParentTask(row.task),
  )
  if (orphanIndex < 0) {
    return null
  }
  let precedingMaxSort = -1
  for (let index = 0; index < orphanIndex; index++) {
    const row = rows[index]!
    if (isTableOrphanParentTask(row.task)) {
      continue
    }
    const task = tasks.find(item => item.id === row.task.id)
    if (task) {
      precedingMaxSort = Math.max(precedingMaxSort, task.sort_order ?? 0)
    }
  }
  let hasFollowingSegment = false
  for (let index = orphanIndex + 1; index < rows.length; index++) {
    const row = rows[index]!
    if (row.kind === 'parent' && !isTableOrphanParentTask(row.task)) {
      hasFollowingSegment = true
      break
    }
    if (row.kind === 'child' || row.kind === 'task') {
      hasFollowingSegment = true
      break
    }
  }
  if (!hasFollowingSegment) {
    return null
  }
  return precedingMaxSort + 1
}
export function hasTableOrphanChildTasks (tasks: TableTask[]): boolean {
  const sorted = sortTableTasks(tasks)
  const taskById = new Map(sorted.map(task => [task.id, task]))
  return collectOrphanTasks(sorted, taskById).length > 0
}
export function buildTableDisplayRows (
  tasks: TableTask[],
  collapsedParentIds: ReadonlySet<number>,
  orphanParentLabel: string = ORPHAN_PARENT_DEFAULT_LABEL,
  orphanParentSortOrder: number | null = null,
): TableDisplayRow[] {
  const sorted = sortTableTasks(tasks)
  const taskById = new Map(sorted.map((task) => [task.id, task]))
  const childrenByParent = new Map<number, TableTask[]>()
  for (const task of sorted) {
    if (task.parent_task_id == null || isOrphanChild(task, taskById)) {
      continue
    }
    const siblings = childrenByParent.get(task.parent_task_id) ?? []
    siblings.push(task)
    childrenByParent.set(task.parent_task_id, siblings)
  }
  const segments: Array<{ anchorSortOrder: number; rows: TableDisplayRow[] }> = []
  for (const task of sorted) {
    if (task.parent_task_id != null && !isOrphanChild(task, taskById)) {
      continue
    }
    if (task.is_parent_task) {
      const children = childrenByParent.get(task.id) ?? []
      segments.push({
        anchorSortOrder: task.sort_order ?? 0,
        rows: buildParentSegmentRows(task, children, collapsedParentIds),
      })
    }
  }
  const orphanTasks = collectOrphanTasks(sorted, taskById)
  const orphanParent = createTableOrphanParentTask(orphanParentLabel)
  const orphanRows: TableDisplayRow[] = [{
    kind: 'parent',
    task: orphanParent,
    childCount: orphanTasks.length,
  }]
  if (!collapsedParentIds.has(orphanParent.id) && orphanTasks.length > 0) {
    for (const task of orphanTasks) {
      orphanRows.push({ kind: 'child', task })
    }
  }
  segments.push({
    anchorSortOrder: resolveOrphanSegmentAnchor(orphanTasks, orphanParentSortOrder),
    rows: orphanRows,
  })
  segments.sort((a, b) => {
    if (a.anchorSortOrder !== b.anchorSortOrder) {
      return a.anchorSortOrder - b.anchorSortOrder
    }
    const aIsOrphan = a.rows[0]?.kind === 'parent' && isTableOrphanParentTask(a.rows[0].task)
    const bIsOrphan = b.rows[0]?.kind === 'parent' && isTableOrphanParentTask(b.rows[0].task)
    if (aIsOrphan && !bIsOrphan) {
      return -1
    }
    if (!aIsOrphan && bIsOrphan) {
      return 1
    }
    return 0
  })
  return segments.flatMap(segment => segment.rows)
}
export function formatTableDate (value: string | null | undefined): string {
  return formatTaskCardSingleDate(value) ?? ''
}
export function formatTableEffort (
  task: TableTask,
  orgUnit?: 'minute' | 'hour' | 'day' | string | null,
): string {
  return formatTaskCardEffort(task, orgUnit) ?? ''
}
export function formatTableDescription (value: string | null | undefined): string {
  if (!value?.trim()) {
    return ''
  }
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
