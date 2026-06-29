import { useApi } from './useApi'
export type OrgDocument = {
  id: number
  name: string
}
export type OrgDocumentsPageSnapshot = {
  documents: OrgDocument[]
}
const cacheBySlug = new Map<string, OrgDocumentsPageSnapshot>()
const inflightBySlug = new Map<string, Promise<OrgDocumentsPageSnapshot>>()
export function useOrgDocumentsPageData () {
  const { api } = useApi()
  async function fetchSnapshot (orgSlug: string): Promise<OrgDocumentsPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }
    const job = (async () => {
      const documentsRes = await api<{ data: OrgDocument[] }>(`/orgs/${slug}/documents`)
      const snapshot: OrgDocumentsPageSnapshot = {
        documents: documentsRes.data,
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
  /** @deprecated 互換用。fetchSnapshot と同じ */
  async function prefetch (orgSlug: string): Promise<OrgDocumentsPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }
  function getCached (orgSlug: string): OrgDocumentsPageSnapshot | null {
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
