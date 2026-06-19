export type SettingsTabKey =
  | 'work_unit_label'
  | 'default_board_lists'
  | 'effort_settings'
  | 'project_labels'
  | 'task_labels'

export type SettingsLabelItem = {
  id: number
  name: string
  color: string
}

export type OrgSettingsResponse = {
  work_unit_label?: string | null
  default_board_list_names?: string[] | null
  effort_unit?: string | null
}

export type SettingsPageSnapshot = {
  orgSettings: OrgSettingsResponse
  projectLabels: SettingsLabelItem[]
  taskLabels: SettingsLabelItem[]
}

export const DEFAULT_BOARD_LIST_NAMES = ['未着手', '進行中', '完了'] as const

export function normalizeDefaultBoardListNames (names: string[] | null | undefined): string[] {
  if (names === null || names === undefined) {
    return [...DEFAULT_BOARD_LIST_NAMES]
  }
  return names
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

export function serializeDefaultBoardListNames (names: string[]): string[] {
  return names
    .map((name) => name.trim())
    .filter((name) => name !== '')
}
