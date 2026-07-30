import { clearCurrentUserId } from './currentUserIdState'
import { clearAllOrgDocumentsPageCaches } from './useOrgDocumentsPageData'
import { clearAllOrgPageCacheWarmup } from './useOrgPageCacheWarmup'
import { clearAllOrgSettingsPageCaches } from './useOrgSettingsPageData'
import { clearAllOrgWorkspaceIndexPageCaches } from './useOrgWorkspaceIndexPageData'
import { clearAllWorkspaceBoardPageCaches } from './useWorkspaceBoardPageData'
import { clearAllWorkspaceDetailMetaCaches } from './useWorkspaceDetailMeta'
import { clearAllWorkspaceTablePageCaches } from './useWorkspaceTablePageData'

/**
 * ログイン／ログアウト時に、前ユーザーの keepalive 画面状態と食い違わないよう
 * モジュールスコープのページキャッシュを破棄する。
 */
export function clearSessionScopedCaches () {
  clearAllOrgSettingsPageCaches()
  clearAllOrgDocumentsPageCaches()
  clearAllOrgWorkspaceIndexPageCaches()
  clearAllWorkspaceBoardPageCaches()
  clearAllWorkspaceTablePageCaches()
  clearAllOrgPageCacheWarmup()
  clearAllWorkspaceDetailMetaCaches()
  clearCurrentUserId()
}
