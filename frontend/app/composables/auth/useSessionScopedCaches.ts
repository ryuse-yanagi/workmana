import { clearCurrentUserId } from './currentUserIdState'
import { clearAvatarUrlOverrides } from './userProfileUpdated'
import { clearAllArchivedNamedItemsCaches } from '../archived/useArchivedNamedItemsCache'
import { clearAllArchivedTasksCaches } from '../archived/useArchivedTasksCache'
import { clearAllOrgDocumentsPageCaches } from '../document/useOrgDocumentsPageData'
import { clearAllOrgPageCacheWarmup } from '../org/useOrgPageCacheWarmup'
import { clearAllOrgSettingsPageCaches } from '../settings/useOrgSettingsPageData'
import { clearAllOrgWorkspaceIndexPageCaches } from '../workspace/useOrgWorkspaceIndexPageData'
import { clearOrgRoleCache } from '../org/useOrgRole'
import { clearAllWorkspaceBoardPageCaches } from '../workspace/useWorkspaceBoardPageData'
import { clearAllWorkspaceWbsPageCaches } from '../wbs/useWorkspaceWbsPageData'

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
