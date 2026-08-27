export type SettingsTabKey =
  | 'organization'
  | 'members'
  | 'workspace_labels'
  | 'workspace_statuses'
  | 'default_board_lists'
  | 'task_labels'
  | 'document_labels'
  | 'document_categories'

export type SettingsMenuItem = {
  key: SettingsTabKey
  label: string
}

export type SettingsMenuSection = {
  title: string
  items: SettingsMenuItem[]
}

export type SettingsLabelTabKey = 'workspace' | 'task' | 'document'

export const SETTINGS_LABEL_TAB_BY_KEY: Partial<Record<SettingsTabKey, SettingsLabelTabKey>> = {
  workspace_labels: 'workspace',
  task_labels: 'task',
  document_labels: 'document',
}

export type SettingsLabelItem = {
  id: number
  category_id?: number
  name: string
  color: string
  color_index?: number
  sort_order?: number
}

export type SettingsLabelCategory = {
  id: number
  name: string
  sort_order: number
  labels: SettingsLabelItem[]
}

export type DefaultNamedColorItem = {
  name: string
  color_index: number
}

export type OrgSettingsResponse = {
  id?: number
  name?: string | null
  slug?: string | null
  icon_url?: string | null
  role?: string | null
  default_board_list_names?: Array<DefaultNamedColorItem | string> | null
  default_workspace_status_names?: Array<DefaultNamedColorItem | string> | null
  default_document_category_names?: Array<DefaultNamedColorItem | string> | null
}

export type SettingsPageSnapshot = {
  orgSettings: OrgSettingsResponse
  workspaceLabelCategories: SettingsLabelCategory[]
  taskLabelCategories: SettingsLabelCategory[]
  documentLabelCategories: SettingsLabelCategory[]
}

export const DEFAULT_BOARD_LIST_ITEMS: DefaultNamedColorItem[] = [
  { name: '未着手', color_index: 0 },
  { name: '進行中', color_index: 1 },
  { name: '完了', color_index: 3 },
]

export const DEFAULT_WORKSPACE_STATUS_ITEMS: DefaultNamedColorItem[] = [
  { name: '準備中', color_index: 1 },
  { name: '稼働中', color_index: 0 },
  { name: '保留', color_index: 3 },
  { name: '完了', color_index: 5 },
]

export const DEFAULT_DOCUMENT_CATEGORY_ITEMS: DefaultNamedColorItem[] = [
  { name: 'その他', color_index: 5 },
]

function normalizeDefaultNamedColorItems (
  raw: Array<DefaultNamedColorItem | string> | null | undefined,
  defaults: DefaultNamedColorItem[],
): DefaultNamedColorItem[] {
  if (raw === null || raw === undefined) {
    return defaults.map(item => ({ ...item }))
  }

  const result: DefaultNamedColorItem[] = []
  raw.forEach((entry, index) => {
    if (typeof entry === 'string') {
      const name = entry.trim()
      if (name === '') return
      const fallback = defaults[index]
      result.push({
        name,
        color_index: fallback?.color_index ?? (index % 10),
      })
      return
    }

    const name = entry.name.trim()
    if (name === '') return
    const fallback = defaults[index]
    const colorIndex = typeof entry.color_index === 'number'
      ? Math.min(Math.max(entry.color_index, 0), 9)
      : (fallback?.color_index ?? (result.length % 10))
    result.push({ name, color_index: colorIndex })
  })

  return result
}

function serializeDefaultNamedColorItems (
  items: DefaultNamedColorItem[],
): DefaultNamedColorItem[] {
  return items
    .map(item => ({
      name: item.name.trim(),
      color_index: Math.min(Math.max(item.color_index, 0), 9),
    }))
    .filter(item => item.name !== '')
}

export function normalizeDefaultBoardListItems (
  raw: OrgSettingsResponse['default_board_list_names'],
): DefaultNamedColorItem[] {
  return normalizeDefaultNamedColorItems(raw, DEFAULT_BOARD_LIST_ITEMS)
}

export function serializeDefaultBoardListItems (items: DefaultNamedColorItem[]): DefaultNamedColorItem[] {
  return serializeDefaultNamedColorItems(items)
}

export function normalizeDefaultWorkspaceStatusItems (
  raw: OrgSettingsResponse['default_workspace_status_names'],
): DefaultNamedColorItem[] {
  return normalizeDefaultNamedColorItems(raw, DEFAULT_WORKSPACE_STATUS_ITEMS)
}

export function serializeDefaultWorkspaceStatusItems (items: DefaultNamedColorItem[]): DefaultNamedColorItem[] {
  return serializeDefaultNamedColorItems(items)
}

export function normalizeDefaultDocumentCategoryItems (
  raw: OrgSettingsResponse['default_document_category_names'],
): DefaultNamedColorItem[] {
  return normalizeDefaultNamedColorItems(raw, DEFAULT_DOCUMENT_CATEGORY_ITEMS)
}

export function serializeDefaultDocumentCategoryItems (items: DefaultNamedColorItem[]): DefaultNamedColorItem[] {
  return serializeDefaultNamedColorItems(items)
}
