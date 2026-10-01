export type TaskPopoverCalendarCell = {
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export type TaskPopoverListOption = {
  id: number
  name: string
  color?: string | null
}

export type TaskPopoverOptionItem = {
  key: string
  name: string
  color: string
  selected: boolean
}

export const TASK_POPOVER_WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
