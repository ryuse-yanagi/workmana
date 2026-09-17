export type TaskCardScheduleFields = {
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
}
const EFFORT_UNIT_LABEL = 'h'
type DateParts = { year: number; month: number; day: number }
function normalizeDateIso (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return null
  }
  return `${match[1]}-${match[2]}-${match[3]}`
}
function parseDateParts (iso: string): DateParts {
  const [yearText = '0', monthText = '0', dayText = '0'] = iso.split('-')
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  }
}
function formatMonthDay ({ month, day }: Pick<DateParts, 'month' | 'day'>): string {
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}
function yearSuffix (year: number, currentYear: number): string {
  return year !== currentYear ? ` (${year})` : ''
}
export function formatTaskCardDateRange (
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
  referenceDate: Date = new Date(),
): string | null {
  const startIso = normalizeDateIso(startDate)
  const dueIso = normalizeDateIso(dueDate)
  const currentYear = referenceDate.getFullYear()
  if (!startIso && !dueIso) {
    return null
  }
  if (startIso && dueIso) {
    const startParts = parseDateParts(startIso)
    const dueParts = parseDateParts(dueIso)
    const startText = formatMonthDay(startParts)
    const dueText = formatMonthDay(dueParts)
    if (startParts.year === dueParts.year) {
      return `${startText} ～ ${dueText}${yearSuffix(startParts.year, currentYear)}`
    }
    return `${startText}${yearSuffix(startParts.year, currentYear)} ～ ${dueText}${yearSuffix(dueParts.year, currentYear)}`
  }
  if (startIso) {
    const parts = parseDateParts(startIso)
    return `${formatMonthDay(parts)}${yearSuffix(parts.year, currentYear)} ～`
  }
  const parts = parseDateParts(dueIso!)
  return `～ ${formatMonthDay(parts)}${yearSuffix(parts.year, currentYear)}`
}
export function formatTaskCardSingleDate (
  value: string | null | undefined,
  referenceDate: Date = new Date(),
): string | null {
  const iso = normalizeDateIso(value)
  if (!iso) {
    return null
  }
  const parts = parseDateParts(iso)
  const currentYear = referenceDate.getFullYear()
  return `${formatMonthDay(parts)}${yearSuffix(parts.year, currentYear)}`
}
function normalizeEffortHours (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) {
    return null
  }
  return Math.round(num * 1000000) / 1000000
}
function formatEffortAmount (value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
}
function resolveStoredEffortValue (task: TaskCardScheduleFields): number | null {
  return normalizeEffortHours(task.effort_hours)
}
export function formatTaskCardProgressRate (
  task: { progress_rate?: number | string | null },
): string | null {
  const raw = task.progress_rate
  if (raw === null || raw === undefined || raw === '') {
    return null
  }
  const num = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(num) || num < 0) {
    return null
  }
  const rounded = Math.round(num * 1000000) / 1000000
  const amount = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, '')
  return `${amount}%`
}
export function formatTaskCardEffort (task: TaskCardScheduleFields): string | null {
  const value = resolveStoredEffortValue(task)
  if (value === null) {
    return null
  }
  return `${formatEffortAmount(value)} ${EFFORT_UNIT_LABEL}`
}
export function hasTaskCardScheduleMeta (task: TaskCardScheduleFields): boolean {
  return !!formatTaskCardDateRange(task.start_date, task.due_date)
    || !!formatTaskCardEffort(task)
    || !!formatTaskCardProgressRate(task)
}
export type TaskCardParentLookup = {
  id: number
  title: string
  is_parent_task?: boolean
}
export type TaskCardParentFields = {
  parent_task_id?: number | null
  parent_task_title?: string | null
}
export function resolveParentTaskTitle (
  task: TaskCardParentFields,
  tasks: TaskCardParentLookup[],
): string | null {
  if (task.parent_task_id == null) {
    return null
  }
  if (task.parent_task_title?.trim()) {
    return task.parent_task_title.trim()
  }
  const parent = tasks.find((item) => item.id === task.parent_task_id)
  return parent?.title?.trim() || null
}
