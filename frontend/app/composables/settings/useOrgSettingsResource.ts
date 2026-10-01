import type { OrgSettingsResponse } from '../../components/settings/types'
import { useApi } from '../shared/useApi'

const cacheBySlug = new Map<string, OrgSettingsResponse>()
const inflightBySlug = new Map<string, Promise<OrgSettingsResponse>>()

export function clearAllOrgSettingsResourceCaches (): void {
  cacheBySlug.clear()
  inflightBySlug.clear()
}

export function getCachedOrgSettings (orgSlug: string): OrgSettingsResponse | null {
  return cacheBySlug.get(orgSlug.trim()) ?? null
}

/** 応答に role が無いときは、既に分かっている権限を残して保存する。 */
export function setCachedOrgSettings (orgSlug: string, settings: OrgSettingsResponse): void {
  const slug = orgSlug.trim()
  const previous = cacheBySlug.get(slug)
  const next: OrgSettingsResponse = { ...settings }
  if ((next.role == null || next.role === '') && previous?.role) {
    next.role = previous.role
  }
  cacheBySlug.set(slug, next)
}

export function invalidateOrgSettingsResource (orgSlug: string): void {
  const slug = orgSlug.trim()
  cacheBySlug.delete(slug)
  inflightBySlug.delete(slug)
}

/**
 * GET /orgs/{slug}/settings の共有キャッシュ。
 * スペース／資料／設定画面が同じレスポンスを取り直さないようにする。
 */
export function useOrgSettingsResource () {
  const { api } = useApi()

  async function fetchOrgSettings (
    orgSlug: string,
    opts?: { refresh?: boolean },
  ): Promise<OrgSettingsResponse> {
    const slug = orgSlug.trim()
    const previousRole = cacheBySlug.get(slug)?.role
    if (opts?.refresh) {
      cacheBySlug.delete(slug)
      inflightBySlug.delete(slug)
    } else {
      const cached = cacheBySlug.get(slug)
      if (cached) {
        return cached
      }
    }

    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const res = await api<OrgSettingsResponse>(`/orgs/${slug}/settings`)
      const stored: OrgSettingsResponse = { ...res }
      if ((stored.role == null || stored.role === '') && previousRole) {
        stored.role = previousRole
      }
      cacheBySlug.set(slug, stored)
      return stored
    })()

    inflightBySlug.set(slug, job)
    try {
      return await job
    } finally {
      if (inflightBySlug.get(slug) === job) {
        inflightBySlug.delete(slug)
      }
    }
  }

  return {
    fetchOrgSettings,
    getCached: getCachedOrgSettings,
    setCached: setCachedOrgSettings,
    invalidateCached: invalidateOrgSettingsResource,
    clearAllCached: clearAllOrgSettingsResourceCaches,
  }
}
