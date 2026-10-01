export type SettingsTabKey =
  | 'organization'
  | 'default_board_lists'
  | 'workspace_statuses'
  | 'document_categories'
  | 'labels'
  | 'workspace_labels'
  | 'task_labels'
  | 'members'

export type SettingsMenuItem = {
  key: SettingsTabKey
  label: string
}

export type SettingsMenuSection = {
  title: string
  items: SettingsMenuItem[]
}

export type SettingsLabelTabKey = 'workspace' | 'task'

export type SettingsItemScope = 'スペース' | 'タスク' | '資料'

/**
 * 設定画面モーダルのタイトル。
 * スコープは括弧で前置し、対象は実在する概念だけを置く
 * （ラベル設定のカテゴリは「カテゴリ」ではなく「ラベルカテゴリ」）。
 */
export function settingsScopedModalTitle (
  scope: SettingsItemScope,
  itemKind: string,
  action: '追加' | '編集' | '削除',
): string {
  return `（${scope}）${itemKind}の${action}`
}

export const SETTINGS_LABEL_TAB_BY_KEY: Partial<Record<SettingsTabKey, SettingsLabelTabKey>> = {
  labels: 'workspace',
  workspace_labels: 'workspace',
  task_labels: 'task',
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
  created_at?: string | null
  default_board_list_names?: Array<DefaultNamedColorItem | string> | null
  default_workspace_status_names?: Array<DefaultNamedColorItem | string> | null
  default_document_category_names?: Array<DefaultNamedColorItem | string> | null
}

export type SettingsPageSnapshot = {
  orgSettings: OrgSettingsResponse
  workspaceLabelCategories: SettingsLabelCategory[]
  taskLabelCategories: SettingsLabelCategory[]
  members?: SettingsOrgMember[]
  memberCount?: number
  pendingInvites?: SettingsPendingInvite[]
}

export type SettingsOrgMember = {
  id: number
  name: string
  email: string
  role?: string | null
  avatar_url?: string | null
}

export type SettingsPendingInvite = {
  id: number
  email: string
  role?: string | null
  expires_at: string
}

import defaultNamedColorItems from '#shared/default-named-color-items.json'

export const DEFAULT_BOARD_LIST_ITEMS: DefaultNamedColorItem[] =
  defaultNamedColorItems.boardLists.map(item => ({ ...item }))

export const DEFAULT_WORKSPACE_STATUS_ITEMS: DefaultNamedColorItem[] =
  defaultNamedColorItems.workspaceStatuses.map(item => ({ ...item }))

export const DEFAULT_DOCUMENT_CATEGORY_ITEMS: DefaultNamedColorItem[] =
  defaultNamedColorItems.documentCategories.map(item => ({ ...item }))

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
