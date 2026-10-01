import { colorPresetFillTextColor } from '../../constants/colorPresets'

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
  progress_rate: number | string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
  category: TaskFormCategory | null
  status: TaskFormCategory | null
}
export const EFFORT_UNIT_LABEL = 'h'
export const PROGRESS_RATE_UNIT_LABEL = '%'
export function createEmptyTaskFormDraft (): TaskFormDraft {
  return {
    title: '',
    description: '',
    start_date: null,
    due_date: null,
    effort_hours: null,
    progress_rate: null,
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

/** `MM/DD`（年なし） */
export function formatMonthDayDisplay (iso: string | null | undefined): string {
  const value = toDateInputValue(iso)
  if (!value) return ''
  const [, m, d] = value.split('-')
  if (!m || !d) return value
  return `${m}/${d}`
}

/** タスク詳細などの期間表示: `MM/DD～MM/DD`。同一日は `MM/DD` のみ（年なし） */
export function formatPeriodDisplay (
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
): string {
  const startIso = toDateInputValue(startDate)
  const dueIso = toDateInputValue(dueDate)
  const start = formatMonthDayDisplay(startDate)
  const due = formatMonthDayDisplay(dueDate)
  if (!start && !due) return ''
  if (start && due) {
    if (startIso === dueIso) return start
    return `${start}～${due}`
  }
  return start || due
}

/**
 * 期間カレンダーのクリック結果。
 * - 未設定: 開始・終了をその日にセット
 * - 開始より前: 開始を更新
 * - 終了より後: 終了を更新
 * - 期間内（両端含む）: 変更なし（null）
 */
export function resolveTaskDateRangePick (
  iso: string,
  startDate: string | Date | null | undefined,
  dueDate: string | Date | null | undefined,
): { start_date: string; due_date: string } | null {
  const start = toDateInputValue(startDate) || null
  const due = toDateInputValue(dueDate) || null
  if (!start || !due) {
    return { start_date: iso, due_date: iso }
  }
  if (iso < start) {
    return { start_date: iso, due_date: due }
  }
  if (iso > due) {
    return { start_date: start, due_date: iso }
  }
  return null
}

/** 開始日・終了日の前後関係に基づく選択下限／上限（ISO `YYYY-MM-DD`） */
export function resolveTaskDatePickBounds (
  field: 'start_date' | 'due_date',
  startDate: string | Date | null | undefined,
  dueDate: string | Date | null | undefined,
): { minIso: string | null; maxIso: string | null } {
  if (field === 'due_date') {
    const minIso = toDateInputValue(startDate) || null
    return { minIso, maxIso: null }
  }
  const maxIso = toDateInputValue(dueDate) || null
  return { minIso: null, maxIso }
}

export function isTaskDateWithinPickBounds (
  iso: string,
  bounds: { minIso: string | null; maxIso: string | null },
): boolean {
  if (bounds.minIso && iso < bounds.minIso) return false
  if (bounds.maxIso && iso > bounds.maxIso) return false
  return true
}

export function taskDatePickOutOfRangeMessage (field: 'start_date' | 'due_date'): string {
  return field === 'due_date'
    ? '開始日以降の日付を選んでください'
    : '終了日以前の日付を選んでください'
}

export function buildTaskCalendarCells (
  cursor: Date,
  bounds: { minIso: string | null; maxIso: string | null } = { minIso: null, maxIso: null },
): Array<{
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
  disabled: boolean
}> {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const todayIso = toDateInputValue(new Date())
  const cells: Array<{
    key: string
    iso: string
    day: number
    inMonth: boolean
    isToday: boolean
    disabled: boolean
  }> = []
  const gridStart = new Date(year, month, 1 - startOffset)
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    const iso = toDateInputValue(date)
    cells.push({
      key: `${iso}-${i}`,
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === todayIso,
      disabled: !isTaskDateWithinPickBounds(iso, bounds),
    })
  }
  return cells
}
/** 負や非数は空にし、小数は 6 桁に丸める。 */
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
/** 0〜100 の整数だけを残し、それ以外は空にする。 */
export function normalizeProgressRate (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > 100) return null
  return num
}
export function resolveStoredProgressRate (draft: Pick<TaskFormDraft, 'progress_rate'>): number | null {
  return normalizeProgressRate(draft.progress_rate)
}
export function progressRateValueToDraft (draft: Pick<TaskFormDraft, 'progress_rate'>): string {
  const value = resolveStoredProgressRate(draft)
  if (value === null) return ''
  return String(value)
}
export function formatProgressRateDisplay (
  draft: Pick<TaskFormDraft, 'progress_rate'>,
): string {
  const value = resolveStoredProgressRate(draft)
  if (value === null) return ''
  return `${value} ${PROGRESS_RATE_UNIT_LABEL}`
}
/** 進捗率入力の桁数上限（0–100） */
export const PROGRESS_RATE_DRAFT_MAX_DIGITS = 3
export function sanitizeProgressRateDraftInput (raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const limited = digits.slice(0, PROGRESS_RATE_DRAFT_MAX_DIGITS)
  const num = Number(limited)
  if (!Number.isFinite(num)) return ''
  if (num > 100) return '100'
  return String(num)
}
export function parseProgressRateDraft (raw: string | number | null | undefined): number | null | 'invalid' {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  const num = Number(trimmed)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > 100) return 'invalid'
  return num
}
export function labelBarTextColor (hex: string): string {
  return colorPresetFillTextColor(hex)
}
/** リスト色バー上の文字色（常に白） */
export function listBarTextColor (_hex: string): string {
  return '#ffffff'
}
export function listBarSurfaceStyle (hex: string): {
  backgroundColor: string
  color: string
} {
  return {
    backgroundColor: hex,
    color: listBarTextColor(hex),
  }
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
  progress_rate?: number | string | null
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
    progress_rate: source.progress_rate ?? null,
    assignees: [...(source.assignees ?? [])],
    labels: [...(source.labels ?? [])],
  }
}
export function orderTaskDateRange (
  a: string,
  b: string,
): { start_date: string; due_date: string } {
  return a <= b
    ? { start_date: a, due_date: b }
    : { start_date: b, due_date: a }
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
    progress_rate: resolveStoredProgressRate(draft),
    assignee_ids: draft.assignees.map(member => member.id),
    label_ids: draft.labels.map(label => label.id),
    is_parent_task: opts.createAsParent,
    parent_task_id: opts.createAsParent ? null : opts.parentTaskId,
  }
}
export const buildTaskAddBody = buildTaskCreateBody
