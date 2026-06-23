import { useOrgIndexPageData } from './useOrgIndexPageData'
import { useOrgSettingsPageData } from './useOrgSettingsPageData'

const inflightBySlug = new Map<string, Promise<void>>()

export function useOrgPageCacheWarmup () {
  const { fetchSnapshot: fetchOrgIndexSnapshot } = useOrgIndexPageData()
  const { fetchSnapshot: fetchOrgSettingsSnapshot } = useOrgSettingsPageData()

  function warmOrgPageCaches (orgSlug: string): Promise<void> {
    const slug = orgSlug.trim()
    if (!slug) {
      return Promise.resolve()
    }

    const existing = inflightBySlug.get(slug)
    if (existing) {
      return existing
    }

    const job = Promise.all([
      fetchOrgIndexSnapshot(slug).catch(() => undefined),
      fetchOrgSettingsSnapshot(slug).catch(() => undefined),
    ]).then(() => undefined)

    inflightBySlug.set(slug, job)
    void job.finally(() => {
      if (inflightBySlug.get(slug) === job) {
        inflightBySlug.delete(slug)
      }
    })

    return job
  }

  return {
    warmOrgPageCaches,
  }
}
