export type TaskFormLabel = { id: number; name: string; color: string }
export type TaskFormCategory = { name: string; color: string }
export type TaskFormMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
export type TaskFormDraft = {
  title: string
  description: string
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
  category: TaskFormCategory | null
  status: TaskFormCategory | null
}
export const EFFORT_UNIT_LABEL = '時間'
export function createEmptyTaskFormDraft (): TaskFormDraft {
  return {
    title: '',
    description: '',
    start_date: null,
    due_date: null,
    effort_hours: null,
    assignees: [],
    labels: [],
    category: null,
    status: null,
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
export function normalizeEffortHours (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 1000000) / 1000000
}
export function resolveStoredEffortValue (draft: Pick<TaskFormDraft, 'effort_hours'>): number | null {
  return normalizeEffortHours(draft.effort_hours)
}
export function formatEffortAmount (value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
}
export function effortValueToDraft (draft: Pick<TaskFormDraft, 'effort_hours'>): string {
  const value = resolveStoredEffortValue(draft)
  if (value === null) return ''
  return formatEffortAmount(value)
}
export function formatEffortDisplay (
  draft: Pick<TaskFormDraft, 'effort_hours'>,
): string {
  const value = resolveStoredEffortValue(draft)
  if (value === null) return ''
  return `${formatEffortAmount(value)} ${EFFORT_UNIT_LABEL}`
}
/** 工数入力の整数部桁数上限（小数点は除く） */
export const EFFORT_DRAFT_MAX_INTEGER_DIGITS = 4
/** 工数入力の小数部桁数上限 */
export const EFFORT_DRAFT_MAX_DECIMAL_DIGITS = 2
export function countEffortIntegerDigits (raw: string): number {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed || trimmed === '.') return 0
  const [integerPart = ''] = trimmed.split('.')
  return integerPart.replace(/\D/g, '').length
}
export function countEffortDecimalDigits (raw: string): number {
  const trimmed = String(raw ?? '').trim()
  const dotIndex = trimmed.indexOf('.')
  if (dotIndex === -1) return 0
  return trimmed.slice(dotIndex + 1).replace(/\D/g, '').length
}
export function sanitizeEffortDraftInput (raw: string): string {
  let value = String(raw ?? '')
  value = value.replace(/[^\d.]/g, '')
  const firstDot = value.indexOf('.')
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '')
  }
  const dotIndex = value.indexOf('.')
  const integerPart = dotIndex === -1 ? value : value.slice(0, dotIndex)
  let decimalPart = dotIndex === -1 ? '' : value.slice(dotIndex)
  const limitedInteger = integerPart.length > EFFORT_DRAFT_MAX_INTEGER_DIGITS
    ? integerPart.slice(0, EFFORT_DRAFT_MAX_INTEGER_DIGITS)
    : integerPart
  if (decimalPart.length > 1) {
    const decimalDigits = decimalPart.slice(1)
    if (decimalDigits.length > EFFORT_DRAFT_MAX_DECIMAL_DIGITS) {
      decimalPart = `.${decimalDigits.slice(0, EFFORT_DRAFT_MAX_DECIMAL_DIGITS)}`
    }
  }
  return limitedInteger + decimalPart
}
export function parseEffortDraft (raw: string | number | null | undefined): number | null | 'invalid' {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  if (countEffortIntegerDigits(trimmed) > EFFORT_DRAFT_MAX_INTEGER_DIGITS) return 'invalid'
  if (countEffortDecimalDigits(trimmed) > EFFORT_DRAFT_MAX_DECIMAL_DIGITS) return 'invalid'
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return 'invalid'
  return Math.round(num * 100) / 100
}
export function labelBarTextColor (hex: string): string {
  const normalized = hex.replace('#', '')
  // mixin.$text-on-surface / $white — 輝度判定は JS のため SCSS 変数を直接参照できない
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
  effort_hours?: number | string | null
  assignees?: TaskFormMember[]
  labels?: TaskFormLabel[]
}
function normalizeDraftDate (value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = toDateInputValue(value)
  return normalized || null
}
/** タスク名・説明以外のフォーム項目をソースタスクの値で上書きする */
export function applyTaskDefaultsToDraft (
  draft: TaskFormDraft,
  source: TaskFormDefaultsSource,
): TaskFormDraft {
  return {
    ...draft,
    start_date: normalizeDraftDate(source.start_date),
    due_date: normalizeDraftDate(source.due_date),
    effort_hours: source.effort_hours ?? null,
    assignees: [...(source.assignees ?? [])],
    labels: [...(source.labels ?? [])],
  }
}
/** 親タスク由来のデフォルト項目（タスク名・説明以外）を空に戻す */
export function clearTaskDraftDefaults (draft: TaskFormDraft): TaskFormDraft {
  const empty = createEmptyTaskFormDraft()
  return {
    ...draft,
    start_date: empty.start_date,
    due_date: empty.due_date,
    effort_hours: empty.effort_hours,
    assignees: [...empty.assignees],
    labels: [...empty.labels],
    category: empty.category,
    status: empty.status,
  }
}
export function buildTaskCreateBody (
  draft: TaskFormDraft,
  opts: {
    listId: number
    createAsParent: boolean
    parentTaskId: number | null
  },
) {
  const title = draft.title.trim()
  return {
    title,
    description: draft.description.trim() === '' ? null : draft.description,
    list_id: opts.listId,
    start_date: draft.start_date,
    due_date: draft.due_date,
    effort_hours: resolveStoredEffortValue(draft),
    assignee_ids: draft.assignees.map(member => member.id),
    label_ids: draft.labels.map(label => label.id),
    is_parent_task: opts.createAsParent,
    parent_task_id: opts.createAsParent ? null : opts.parentTaskId,
  }
}
