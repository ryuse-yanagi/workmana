import { clearCurrentUserId } from './currentUserIdState'
import { clearAvatarUrlOverrides } from './userProfileUpdated'
import { clearAllArchivedNamedItemsCaches } from './useArchivedNamedItemsCache'
import { clearAllArchivedTasksCaches } from './useArchivedTasksCache'
import { clearAllOrgDocumentsPageCaches } from './useOrgDocumentsPageData'
import { clearAllOrgPageCacheWarmup } from './useOrgPageCacheWarmup'
import { clearAllOrgSettingsPageCaches } from './useOrgSettingsPageData'
import { clearAllOrgWorkspaceIndexPageCaches } from './useOrgWorkspaceIndexPageData'
import { clearOrgRoleCache } from './useOrgRole'
import { clearAllWorkspaceBoardPageCaches } from './useWorkspaceBoardPageData'
import { clearAllWorkspaceWbsPageCaches } from './useWorkspaceWbsPageData'

/**
 * ログイン／ログアウト時に、前ユーザーの keepalive 画面状態と食い違わないよう
 * モジュールスコープのページキャッシュを破棄する。
 */
export function clearSessionScopedCaches () {
  clearAllOrgSettingsPageCaches()
  clearAllOrgDocumentsPageCaches()
  clearAllOrgWorkspaceIndexPageCaches()
  clearAllWorkspaceBoardPageCaches()
  clearAllWorkspaceWbsPageCaches()
  clearAllArchivedNamedItemsCaches()
  clearAllArchivedTasksCaches()
  clearAllOrgPageCacheWarmup()
  clearOrgRoleCache()
  clearAvatarUrlOverrides()
  clearCurrentUserId()
}
