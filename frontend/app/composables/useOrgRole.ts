import { useAuth } from './useAuth'

type OrgRole = 'admin' | 'member' | null

const roleCache = new Map<string, OrgRole>()

export function clearOrgRoleCache (): void {
  roleCache.clear()
}

export function useOrgRole (orgSlug: Ref<string> | ComputedRef<string> | string) {
  const { fetchSession } = useAuth()
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
    const cacheKey = slug
    if (!force && roleCache.has(cacheKey)) {
      orgRole.value = roleCache.get(cacheKey) ?? null
      return
    }
    const session = await fetchSession()
    const userId = session.user?.id
    const keyed = userId ? `${userId}:${slug}` : slug
    // Drop stale slug-only entries from older cache versions
    if (roleCache.has(slug) && keyed !== slug) {
      roleCache.delete(slug)
    }
    const org = session.user?.organizations?.find(item => item.slug === slug)
    const role: OrgRole = org?.role === 'admin'
      ? 'admin'
      : org?.role === 'member'
        ? 'member'
        : null
    roleCache.set(keyed, role)
    roleCache.set(slug, role)
    orgRole.value = role
  }

  const isOrgAdmin = computed(() => orgRole.value === 'admin')

  watch(() => resolveSlug(), () => {
    void refresh(true)
  }, { immediate: true })

  return {
    isOrgAdmin,
    orgRole: readonly(orgRole),
    refresh,
  }
}
