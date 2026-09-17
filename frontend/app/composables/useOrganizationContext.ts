import { useApi } from './useApi'
import type { AuthUser } from './useAuth'

export type OrganizationSummary = {
  id: number
  name: string
  slug: string
  role?: string
  icon_url?: string | null
}

/**
 * ログイン後の利用組織決定と組織切替。
 * 組織コンテキストは URL の slug と last_organization_id で扱う。
 */
export function useOrganizationContext () {
  const { api } = useApi()

  function orgTopPath (slug: string): string {
    return `/org/${slug}/workspaces`
  }

  async function fetchCurrentOrganization (): Promise<OrganizationSummary | null> {
    const res = await api<{ organization: OrganizationSummary | null }>('/me/current-organization')
    return res.organization
  }

  async function switchOrganization (target: { id?: number, slug?: string }): Promise<OrganizationSummary> {
    const body: Record<string, string | number> = {}
    if (target.id != null) {
      body.organization_id = target.id
    }
    if (target.slug) {
      body.slug = target.slug
    }
    const res = await api<{ organization: OrganizationSummary }>('/me/current-organization', {
      method: 'PUT',
      body,
    })
    return res.organization
  }

  /**
   * 所属状況に応じた遷移先。
   * 0件 → 組織作成、1件以上 → 解決した組織トップ（サーバー側で last_organization_id 更新）。
   */
    async function resolvePostLoginPath (user?: AuthUser | null): Promise<string> {
    const sessionOrgs = user?.organizations ?? []
    if (sessionOrgs.length === 0) {
      return '/organizations/new'
    }

    const lastId = user?.last_organization_id ?? null
    const preferred = lastId != null
      ? sessionOrgs.find(org => org.id === lastId)
      : null
    const slug = (preferred ?? sessionOrgs[0])?.slug?.trim()
    if (slug) {
      return orgTopPath(slug)
    }

    try {
      const organization = await fetchCurrentOrganization()
      if (organization?.slug) {
        return orgTopPath(organization.slug)
      }
    } catch {
      // フォールバック: セッション先頭の組織へ
    }

    return orgTopPath(sessionOrgs[0].slug)
  }

  return {
    orgTopPath,
    fetchCurrentOrganization,
    switchOrganization,
    resolvePostLoginPath,
  }
}
