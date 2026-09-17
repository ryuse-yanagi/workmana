import { clearAllOrgDocumentsPageCaches, useOrgDocumentsPageData } from './useOrgDocumentsPageData'
import { useOrgWorkspaceIndexPageData } from './useOrgWorkspaceIndexPageData'
import { useWorkspaceBoardPageData } from './useWorkspaceBoardPageData'
import { useWorkspaceWbsPageData } from './useWorkspaceWbsPageData'
import { invalidateOrgSettingsResource } from './useOrgSettingsResource'
import type { SettingsLabelTabKey } from '../components/settings/types'

export type OrgDerivedCacheScope = {
  /** 組織ワークスペース一覧・ラベル・ステータス正本 */
  workspaceIndex?: boolean
  /** タスクラベルを抱えるボード／WBS */
  taskViews?: boolean
  /** 資料メタ（カテゴリ・ラベル）と資料詳細キャッシュ */
  documents?: boolean
  /** GET /settings の共有リソース */
  settingsResource?: boolean
}

/**
 * 設定変更などで「組織由来マスタ」が変わったとき、派生キャッシュをまとめて破棄する。
 * 部分 patch より invalidate を優先し、古いラベル／ステータスの残存を防ぐ。
 */
export function invalidateOrgDerivedCaches (
  orgSlug: string,
  scope: OrgDerivedCacheScope = {
    workspaceIndex: true,
    taskViews: true,
    documents: true,
    settingsResource: true,
  },
): void {
  const slug = orgSlug.trim()
  if (!slug) {
    return
  }

  if (scope.settingsResource) {
    invalidateOrgSettingsResource(slug)
  }

  if (scope.workspaceIndex) {
    const { invalidateCached } = useOrgWorkspaceIndexPageData()
    invalidateCached(slug)
  }

  if (scope.taskViews) {
    invalidateAllWorkspaceViewCachesForOrg(slug)
  }

  if (scope.documents) {
    const { invalidateCached } = useOrgDocumentsPageData()
    invalidateCached(slug)
    // 資料詳細に埋め込まれたラベル／カテゴリも破棄（メタだけ残すと不整合）
    clearDocumentDetailCachesForOrg(slug)
  }
}

export function invalidateOrgDerivedCachesForLabelKind (
  orgSlug: string,
  labelKind: SettingsLabelTabKey,
): void {
  if (labelKind === 'workspace') {
    invalidateOrgDerivedCaches(orgSlug, {
      workspaceIndex: true,
      taskViews: false,
      documents: false,
      settingsResource: false,
    })
    return
  }
  if (labelKind === 'task') {
    invalidateOrgDerivedCaches(orgSlug, {
      workspaceIndex: false,
      taskViews: true,
      documents: false,
      settingsResource: false,
    })
    return
  }
  invalidateOrgDerivedCaches(orgSlug, {
    workspaceIndex: false,
    taskViews: false,
    documents: true,
    settingsResource: false,
  })
}

/** ボード／WBS の当該組織キーをすべて破棄 */
export function invalidateAllWorkspaceViewCachesForOrg (orgSlug: string): void {
  const slug = orgSlug.trim()
  const { invalidateCached: invalidateBoard } = useWorkspaceBoardPageData()
  const { invalidateCached: invalidateWbs } = useWorkspaceWbsPageData()
  const boardMap = getWorkspaceBoardCacheKeys(slug)
  for (const workspaceId of boardMap) {
    invalidateBoard(slug, workspaceId)
    invalidateWbs(slug, workspaceId)
  }
  // ボードに無いが WBS だけあるキーも落とす
  const wbsOnly = getWorkspaceWbsCacheKeys(slug).filter(id => !boardMap.includes(id))
  for (const workspaceId of wbsOnly) {
    invalidateWbs(slug, workspaceId)
  }
}

export function invalidateWorkspaceViewCaches (
  orgSlug: string,
  workspaceId: string | number,
): void {
  const slug = orgSlug.trim()
  const id = String(workspaceId).trim()
  const { invalidateCached: invalidateBoard } = useWorkspaceBoardPageData()
  const { invalidateCached: invalidateWbs } = useWorkspaceWbsPageData()
  invalidateBoard(slug, id)
  invalidateWbs(slug, id)
}

function getWorkspaceBoardCacheKeys (orgSlug: string): string[] {
  const { getWorkspaceBoardCacheMap } = requireBoardCacheMap()
  const prefix = `${orgSlug.trim()}:`
  const ids: string[] = []
  for (const key of getWorkspaceBoardCacheMap().keys()) {
    if (key.startsWith(prefix)) {
      ids.push(key.slice(prefix.length))
    }
  }
  return ids
}

function getWorkspaceWbsCacheKeys (orgSlug: string): string[] {
  const { getWorkspaceWbsCacheMap } = requireWbsCacheMap()
  const prefix = `${orgSlug.trim()}:`
  const ids: string[] = []
  for (const key of getWorkspaceWbsCacheMap().keys()) {
    if (key.startsWith(prefix)) {
      ids.push(key.slice(prefix.length))
    }
  }
  return ids
}

function requireBoardCacheMap () {
  // 循環 import を避けるため動的ではなく通常 import 済みの getter を使う
  return { getWorkspaceBoardCacheMap: getBoardMap }
}

function requireWbsCacheMap () {
  return { getWorkspaceWbsCacheMap: getWbsMap }
}

import { getWorkspaceBoardCacheMap as getBoardMap } from './useWorkspaceBoardPageData'
import { getWorkspaceWbsCacheMap as getWbsMap } from './useWorkspaceWbsPageData'

function clearDocumentDetailCachesForOrg (orgSlug: string): void {
  // useOrgDocumentsPageData は slug 単位の meta invalidate に加え、
  // 詳細 Map を org 単位で消す API が無いため clear + meta 再取得に任せるより
  // 公開 clearAll はセッション全体なので、個別削除ヘルパを使う。
  const { clearDocumentCachesForOrg } = useOrgDocumentsPageData()
  clearDocumentCachesForOrg?.(orgSlug)
}
