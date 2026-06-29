import { DEFAULT_COLOR_PRESET } from '../constants/colorPresets'
export type GanttDay = {
  iso: string
  year: number
  month: number
  day: number
  weekday: string
  weekdayIndex: number
  isToday: boolean
  isWeekend: boolean
}
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
export function normalizeGanttDateIso (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return null
  }
  return `${match[1]}-${match[2]}-${match[3]}`
}
export function buildMonthDays (
  year: number,
  month: number,
  referenceDate: Date = new Date(),
): GanttDay[] {
  const todayIso = formatIsoDate(referenceDate)
  const daysInMonth = new Date(year, month, 0).getDate()
  const result: GanttDay[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day)
    const weekdayIndex = date.getDay()
    const iso = formatIsoDate(date)
    result.push({
      iso,
      year,
      month,
      day,
      weekday: WEEKDAY_LABELS[weekdayIndex] ?? '',
      weekdayIndex,
      isToday: iso === todayIso,
      isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
    })
  }
  return result
}
export function formatGanttMonthLabel (year: number, month: number): string {
  return `${year}年${month}月`
}
export function formatGanttDayHeader (day: GanttDay): string {
  return `${String(day.month).padStart(2, '0')}/${String(day.day).padStart(2, '0')}`
}
export function resolveTaskDateRange (task: {
  start_date?: string | null
  due_date?: string | null
}): { start: string; end: string } | null {
  const startIso = normalizeGanttDateIso(task.start_date)
  const dueIso = normalizeGanttDateIso(task.due_date)
  if (!startIso && !dueIso) {
    return null
  }
  if (startIso && dueIso) {
    return startIso <= dueIso
      ? { start: startIso, end: dueIso }
      : { start: dueIso, end: startIso }
  }
  const single = startIso ?? dueIso!
  return { start: single, end: single }
}
export function isIsoInInclusiveRange (iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}
export function isTaskActiveOnDay (
  task: { start_date?: string | null; due_date?: string | null },
  dayIso: string,
): boolean {
  const range = resolveTaskDateRange(task)
  if (!range) {
    return false
  }
  return isIsoInInclusiveRange(dayIso, range.start, range.end)
}
export function resolveGanttBarColor (task: {
  gantt_bar_color?: string | null
  labels?: Array<{ color: string }> | null
}): string {
  const saved = task.gantt_bar_color?.trim()
  if (saved) {
    return saved
  }
  const labelColor = task.labels?.[0]?.color?.trim()
  if (labelColor) {
    return labelColor
  }
  return DEFAULT_COLOR_PRESET
}
function formatIsoDate (date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export function currentYearMonth (): { year: number; month: number } {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}
export function shiftVisibleMonth (
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1)
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }
}
