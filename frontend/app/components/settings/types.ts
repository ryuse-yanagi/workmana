export type SettingsTabKey =
  | 'default_board_lists'
  | 'effort_settings'
  | 'labels'

export type SettingsLabelTabKey = 'workspace' | 'task'

export type SettingsLabelItem = {
  id: number
  category_id?: number
  name: string
  color: string
  color_index?: number
}

export type SettingsLabelCategory = {
  id: number
  name: string
  sort_order: number
  labels: SettingsLabelItem[]
}

export type OrgSettingsResponse = {
  default_board_list_names?: string[] | null
  effort_unit?: string | null
}

export type SettingsPageSnapshot = {
  orgSettings: OrgSettingsResponse
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
