export type EffortUnit = 'minute' | 'hour' | 'day'

export type TaskCardScheduleFields = {
  start_date?: string | null
  due_date?: string | null
  effort_value?: number | string | null
  effort_unit?: EffortUnit | string | null
  effort_hours?: number | string | null
}

const EFFORT_UNIT_LABELS: Record<EffortUnit, string> = {
  minute: '分',
  hour: '時間',
  day: '日',
}

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
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
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

function normalizeEffortUnit (value: EffortUnit | string | null | undefined): EffortUnit {
  if (value === 'minute' || value === 'hour' || value === 'day') {
    return value
  }
  return 'hour'
}

function resolveEffortUnit (
  taskUnit: EffortUnit | string | null | undefined,
  orgUnit?: EffortUnit | string | null | undefined,
): EffortUnit {
  if (taskUnit === 'minute' || taskUnit === 'hour' || taskUnit === 'day') {
    return taskUnit
  }
  return normalizeEffortUnit(orgUnit)
}

function normalizeEffortValue (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) {
    return null
  }
  return Math.round(num * 10000) / 10000
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

function hoursToUnitValue (hours: number, unit: EffortUnit): number {
  if (unit === 'minute') {
    return hours * 60
  }
  if (unit === 'day') {
    return hours / 24
  }
  return hours
}

function formatEffortAmount (value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
}

function resolveStoredEffortValue (
  task: TaskCardScheduleFields,
  orgUnit?: EffortUnit | string | null,
): number | null {
  const stored = normalizeEffortValue(task.effort_value)
  if (stored !== null) {
    return stored
  }
  const hours = normalizeEffortHours(task.effort_hours)
  if (hours === null) {
    return null
  }
  return normalizeEffortValue(
    hoursToUnitValue(hours, resolveEffortUnit(task.effort_unit, orgUnit)),
  )
}

export function formatTaskCardEffort (
  task: TaskCardScheduleFields,
  orgUnit?: EffortUnit | string | null,
): string | null {
  const value = resolveStoredEffortValue(task, orgUnit)
  if (value === null) {
    return null
  }
  const unit = resolveEffortUnit(task.effort_unit, orgUnit)
  return `${formatEffortAmount(value)}${EFFORT_UNIT_LABELS[unit]}`
}

export function hasTaskCardScheduleMeta (task: TaskCardScheduleFields): boolean {
  return !!formatTaskCardDateRange(task.start_date, task.due_date)
    || !!formatTaskCardEffort(task)
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
  if (task.parent_task_title?.trim()) {
    return task.parent_task_title.trim()
  }
  if (task.parent_task_id == null) {
    return null
  }
  const parent = tasks.find((item) => item.id === task.parent_task_id)
  return parent?.title?.trim() || null
}
