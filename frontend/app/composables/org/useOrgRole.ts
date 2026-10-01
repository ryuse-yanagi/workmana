import { useAuth } from '../auth/useAuth'

type OrgRole = 'admin' | 'member' | null

const roleCache = new Map<string, OrgRole>()
const roleRefreshGenerationBySlug = new Map<string, number>()

export function clearOrgRoleCache (): void {
  roleCache.clear()
  roleRefreshGenerationBySlug.clear()
}

function knownRole (slug: string): OrgRole {
  const role = roleCache.get(slug) ?? null
  return role === 'admin' || role === 'member' ? role : null
}

function explicitRole (role: string | null | undefined): OrgRole {
  if (role === 'admin' || role === 'member') {
    return role
  }
  return null
}

export function useOrgRole (orgSlug: Ref<string> | ComputedRef<string> | string) {
  const { fetchSession, session } = useAuth()
  const orgRole = ref<OrgRole>(null)

  function resolveSlug (): string {
    const value = unref(orgSlug)
    return typeof value === 'string' ? value.trim() : ''
  }

  async function refresh (force = false) {
    const slug = resolveSlug()
    if (!slug) {
      orgRole.value = null
      return
    }
    if (!force && roleCache.has(slug)) {
      orgRole.value = roleCache.get(slug) ?? null
      return
    }
    const generation = (roleRefreshGenerationBySlug.get(slug) ?? 0) + 1
    roleRefreshGenerationBySlug.set(slug, generation)
    const authSession = await fetchSession()
    if (roleRefreshGenerationBySlug.get(slug) !== generation || resolveSlug() !== slug) {
      return
    }
    const user = authSession.user
    const organizations = user?.organizations
    const previous = knownRole(slug)
    let role: OrgRole = null
    if (!user) {
      role = null
    } else if (!Array.isArray(organizations)) {
      role = previous
    } else {
      const org = organizations.find(item => item.slug === slug)
      const stated = explicitRole(org?.role)
      if (stated) {
        role = stated
      } else if (org && previous) {
        // 組織はあるが role が欠ける応答では、管理者を一般ユーザーに落とさない。
        role = previous
      } else {
        role = null
      }
    }
    const userId = user?.id
    const keyed = userId ? `${userId}:${slug}` : slug
    if (roleCache.has(slug) && keyed !== slug) {
      roleCache.delete(slug)
    }
    roleCache.set(keyed, role)
    roleCache.set(slug, role)
    orgRole.value = role
  }

  const isOrgAdmin = computed(() => orgRole.value === 'admin')

  if (import.meta.client) {
    const initialSlug = resolveSlug()
    if (initialSlug && roleCache.has(initialSlug)) {
      orgRole.value = roleCache.get(initialSlug) ?? null
    }
    watch(
      () => {
        const slug = resolveSlug()
        const organizations = session.value?.user?.organizations
        const org = organizations?.find(item => item.slug === slug)
        const listed = Array.isArray(organizations)
        return `${slug}|${session.value?.user?.id ?? ''}|${listed ? '1' : '0'}|${org ? '1' : '0'}|${org?.role ?? ''}`
      },
      () => {
        void refresh(true)
      },
      { immediate: true },
    )
  }

  return {
    isOrgAdmin,
    orgRole: readonly(orgRole),
    refresh,
  }
}
