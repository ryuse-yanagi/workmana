import { useOrgDocumentsPageData } from './useOrgDocumentsPageData'
import { useOrgWorkspaceIndexPageData } from './useOrgWorkspaceIndexPageData'

const inflightBySlug = new Map<string, Promise<void>>()

export function clearAllOrgPageCacheWarmup (): void {
  inflightBySlug.clear()
}

export function useOrgPageCacheWarmup () {
  const { fetchSnapshot: fetchOrgWorkspaceIndexSnapshot } = useOrgWorkspaceIndexPageData()
  const { fetchSnapshot: fetchOrgDocumentsSnapshot } = useOrgDocumentsPageData()
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
      fetchOrgWorkspaceIndexSnapshot(slug).catch(() => undefined),
      fetchOrgDocumentsSnapshot(slug).catch(() => undefined),
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
    clearAllCached: clearAllOrgPageCacheWarmup,
  }
}
