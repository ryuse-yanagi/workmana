import type { SettingsPageSnapshot } from '../components/settings/types'
import { normalizeEffortUnit } from './useTaskFormHelpers'
import { useApi } from './useApi'
import { useOrgEffortSettings } from './useOrgEffortSettings'

const cacheBySlug = new Map<string, SettingsPageSnapshot>()
const inflightBySlug = new Map<string, Promise<SettingsPageSnapshot>>()

export function useOrgSettingsPageData () {
  const { api } = useApi()
  const { syncEffortSettings } = useOrgEffortSettings()

  async function fetchSnapshot (orgSlug: string): Promise<SettingsPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const orgSettings = await api<SettingsPageSnapshot['orgSettings']>(`/orgs/${slug}/settings`)
      syncEffortSettings(slug, {
        effort_unit: normalizeEffortUnit(orgSettings.effort_unit),
      })
      const snapshot: SettingsPageSnapshot = {
        orgSettings,
      }
      cacheBySlug.set(slug, snapshot)
      return snapshot
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

  async function prefetch (orgSlug: string): Promise<SettingsPageSnapshot> {
    const slug = orgSlug.trim()
    const cached = cacheBySlug.get(slug)
    if (cached) {
      return cached
    }
    return fetchSnapshot(slug)
  }

  function getCached (orgSlug: string): SettingsPageSnapshot | null {
    return cacheBySlug.get(orgSlug.trim()) ?? null
  }

  function invalidateCached (orgSlug: string): void {
    cacheBySlug.delete(orgSlug.trim())
  }

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    invalidateCached,
  }
}
