import type { OrgSettingsResponse } from '../components/settings/types'
import { useApi } from './useApi'

const cacheBySlug = new Map<string, OrgSettingsResponse>()
const inflightBySlug = new Map<string, Promise<OrgSettingsResponse>>()

export function clearAllOrgSettingsResourceCaches (): void {
  cacheBySlug.clear()
  inflightBySlug.clear()
}

export function getCachedOrgSettings (orgSlug: string): OrgSettingsResponse | null {
  return cacheBySlug.get(orgSlug.trim()) ?? null
}

export function setCachedOrgSettings (orgSlug: string, settings: OrgSettingsResponse): void {
  cacheBySlug.set(orgSlug.trim(), settings)
}

export function invalidateOrgSettingsResource (orgSlug: string): void {
  const slug = orgSlug.trim()
  cacheBySlug.delete(slug)
  inflightBySlug.delete(slug)
}

/**
 * GET /orgs/{slug}/settings の共有キャッシュ。
 * ワークスペース／資料／設定画面が同じレスポンスを取り直さないようにする。
 */
export function useOrgSettingsResource () {
  const { api } = useApi()

  async function fetchOrgSettings (
    orgSlug: string,
    opts?: { refresh?: boolean },
  ): Promise<OrgSettingsResponse> {
    const slug = orgSlug.trim()
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
      cacheBySlug.set(slug, res)
      return res
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
