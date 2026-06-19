export type TaskFormLabel = { id: number; name: string; color: string }
export type TaskFormMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}

export type TaskFormEffortUnit = 'minute' | 'hour' | 'day'

export type TaskFormDraft = {
  title: string
  description: string
  start_date: string | null
  due_date: string | null
  effort_value: number | string | null
  effort_hours: number | string | null
  effort_unit: TaskFormEffortUnit | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}

export const EFFORT_UNIT_OPTIONS: { value: TaskFormEffortUnit, label: string }[] = [
  { value: 'minute', label: '分' },
  { value: 'hour', label: '時間' },
  { value: 'day', label: '日' },
]

export function createEmptyTaskFormDraft (): TaskFormDraft {
  return {
    title: '',
    description: '',
    start_date: null,
    due_date: null,
    effort_value: null,
    effort_hours: null,
    effort_unit: null,
    assignees: [],
    labels: [],
  }
}

export function formatLocalDate (date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toDateInputValue (value: string | Date | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    return formatLocalDate(value)
  }
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed)
  }
  return trimmed.slice(0, 10)
}

export function formatDateDisplay (iso: string | null | undefined): string {
  const value = toDateInputValue(iso)
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${y}/${m}/${d}`
}

export function normalizeEffortUnit (value: TaskFormEffortUnit | string | null | undefined): TaskFormEffortUnit {
  if (value === 'minute' || value === 'hour' || value === 'day') {
    return value
  }
  return 'hour'
}

export function resolveEffortUnit (
  taskUnit: TaskFormEffortUnit | string | null | undefined,
  orgUnit?: TaskFormEffortUnit | string | null | undefined,
): TaskFormEffortUnit {
  if (taskUnit === 'minute' || taskUnit === 'hour' || taskUnit === 'day') {
    return taskUnit
  }
  return normalizeEffortUnit(orgUnit)
}

export function effortUnitLabel (unit: TaskFormEffortUnit | string | null | undefined): string {
  const normalized = normalizeEffortUnit(unit)
  return EFFORT_UNIT_OPTIONS.find(option => option.value === normalized)?.label ?? '時間'
}

export function hoursToUnitValue (hours: number, unit: TaskFormEffortUnit): number {
  if (unit === 'minute') return hours * 60
  if (unit === 'day') return hours / 24
  return hours
}

export function unitValueToHours (value: number, unit: TaskFormEffortUnit): number {
  if (unit === 'minute') return value / 60
  if (unit === 'day') return value * 24
  return value
}

export function normalizeEffortHours (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 1000000) / 1000000
}

export function normalizeEffortValue (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 10000) / 10000
}

export function resolveStoredEffortValue (draft: Pick<TaskFormDraft, 'effort_value' | 'effort_hours' | 'effort_unit'>): number | null {
  const stored = normalizeEffortValue(draft.effort_value)
  if (stored !== null) return stored
  const hours = normalizeEffortHours(draft.effort_hours)
  if (hours === null) return null
  return normalizeEffortValue(hoursToUnitValue(hours, normalizeEffortUnit(draft.effort_unit)))
}

export function formatEffortAmount (value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
}

export function effortValueToDraft (draft: Pick<TaskFormDraft, 'effort_value' | 'effort_hours' | 'effort_unit'>): string {
  const value = resolveStoredEffortValue(draft)
  if (value === null) return ''
  return formatEffortAmount(value)
}

export function formatEffortDisplay (
  draft: Pick<TaskFormDraft, 'effort_value' | 'effort_hours' | 'effort_unit'>,
  orgUnit?: TaskFormEffortUnit | string | null,
): string {
  const value = resolveStoredEffortValue(draft)
  if (value === null) return ''
  const unit = resolveEffortUnit(draft.effort_unit, orgUnit)
  return `${formatEffortAmount(value)} ${effortUnitLabel(unit)}`
}

export function parseEffortDraft (raw: string | number | null | undefined): number | null | 'invalid' {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return 'invalid'
  return Math.round(num * 100) / 100
}

export function labelBarTextColor (hex: string): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return '#172b4d'
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return '#172b4d'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#172b4d' : '#ffffff'
}

export function memberEmailLine (member: TaskFormMember): string {
  const email = member.email?.trim()
  if (email) return email
  return `@user${member.id}`
}

export type TaskFormDefaultsSource = {
  start_date?: string | null
  due_date?: string | null
  effort_value?: number | string | null
  effort_hours?: number | string | null
  effort_unit?: TaskFormEffortUnit | string | null
  assignees?: TaskFormMember[]
  labels?: TaskFormLabel[]
}

function normalizeDraftDate (value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = toDateInputValue(value)
  return normalized || null
}

/** タスク名・備考以外のフォーム項目をソースタスクの値で上書きする */
export function applyTaskDefaultsToDraft (
  draft: TaskFormDraft,
  source: TaskFormDefaultsSource,
): TaskFormDraft {
  const effortValue = source.effort_value ?? null
  return {
    ...draft,
    start_date: normalizeDraftDate(source.start_date),
    due_date: normalizeDraftDate(source.due_date),
    effort_value: effortValue,
    effort_hours: source.effort_hours ?? null,
    effort_unit: effortValue === null
      ? null
      : normalizeEffortUnit(source.effort_unit),
    assignees: [...(source.assignees ?? [])],
    labels: [...(source.labels ?? [])],
  }
}

/** 親タスク由来のデフォルト項目（タスク名・備考以外）を空に戻す */
export function clearTaskDraftDefaults (draft: TaskFormDraft): TaskFormDraft {
  const empty = createEmptyTaskFormDraft()
  return {
    ...draft,
    start_date: empty.start_date,
    due_date: empty.due_date,
    effort_value: empty.effort_value,
    effort_hours: empty.effort_hours,
    effort_unit: empty.effort_unit,
    assignees: [...empty.assignees],
    labels: [...empty.labels],
  }
}

export function buildTaskCreateBody (
  draft: TaskFormDraft,
  opts: {
    listId: number
    createAsParent: boolean
    parentTaskId: number | null
    orgEffortUnit?: TaskFormEffortUnit | string | null
  },
) {
  const title = draft.title.trim()
  const effortValue = resolveStoredEffortValue(draft)
  const effortUnit = effortValue === null
    ? null
    : resolveEffortUnit(draft.effort_unit, opts.orgEffortUnit)

  return {
    title,
    description: draft.description.trim() === '' ? null : draft.description,
    list_id: opts.listId,
    status: 'todo',
    start_date: draft.start_date,
    due_date: draft.due_date,
    effort_value: effortValue,
    effort_unit: effortUnit,
    assignee_ids: draft.assignees.map(member => member.id),
    label_ids: draft.labels.map(label => label.id),
    is_parent_task: opts.createAsParent,
    parent_task_id: opts.createAsParent ? null : opts.parentTaskId,
  }
}
