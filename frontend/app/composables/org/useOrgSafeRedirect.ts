import { useApi } from '../shared/useApi'
import { useAuth } from '../auth/useAuth'
import { useOrganizationContext } from './useOrganizationContext'
import { useOrgWorkspaceIndexPageData } from '../workspace/useOrgWorkspaceIndexPageData'

/**
 * 到達不能 URL からの退避先。
 * - スペース詳細: アクティブな先頭スペース（なければ一覧）
 * - メンバーホーム: last_organization のスペース一覧
 */
export function useOrgSafeRedirect () {
  const { api } = useApi()
  const { fetchSession } = useAuth()
  const { resolvePostLoginPath, orgTopPath } = useOrganizationContext()
  const { getCached } = useOrgWorkspaceIndexPageData()

  async function redirectToOrgWorkspaceList (slug: string): Promise<void> {
    await navigateTo(orgTopPath(slug), { replace: true })
  }

  async function redirectToWorkspaceDetail (slug: string): Promise<void> {
    const trimmed = slug.trim()
    if (!trimmed) {
      await redirectToMemberHome()
      return
    }

    const cached = getCached(trimmed)
    const fromCache = cached?.workspaces.find(item => !item.archived_at)
      ?? cached?.workspaces[0]
    if (fromCache) {
      await navigateTo(`/org/${trimmed}/workspaces/${fromCache.id}`, { replace: true })
      return
    }

    try {
      const res = await api<{ data: Array<{ id: number; archived_at?: string | null }> }>(
        `/orgs/${trimmed}/workspaces`,
      )
      const first = (res.data ?? []).find(item => !item.archived_at) ?? res.data?.[0]
      if (first) {
        await navigateTo(`/org/${trimmed}/workspaces/${first.id}`, { replace: true })
        return
      }
    } catch {
      // 一覧へフォールバック
    }

    await redirectToOrgWorkspaceList(trimmed)
  }

  async function redirectToMemberHome (): Promise<void> {
    const session = await fetchSession()
    if (!session.authenticated || !session.user) {
      await navigateTo('/login', { replace: true })
      return
    }
    const path = await resolvePostLoginPath(session.user)
    await navigateTo(path, { replace: true })
  }

  return {
    redirectToWorkspaceDetail,
    redirectToOrgWorkspaceList,
    redirectToMemberHome,
  }
}
