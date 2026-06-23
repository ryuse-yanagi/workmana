import { useApi } from './useApi'
import { useOrgTerminology } from './useOrgTerminology'

export type OrgIndexLabel = {
  id: number
  name: string
  color: string
}

export type OrgIndexProject = {
  id: number
  name: string
  labels?: OrgIndexLabel[]
}

export type OrgIndexPageSnapshot = {
  projects: OrgIndexProject[]
  orgLabels: OrgIndexLabel[]
  workUnitLabel: string
}

const cacheBySlug = new Map<string, OrgIndexPageSnapshot>()
const inflightBySlug = new Map<string, Promise<OrgIndexPageSnapshot>>()

export function useOrgIndexPageData () {
  const { api } = useApi()
  const { fetchWorkUnitLabel, syncLabelState } = useOrgTerminology()

  async function fetchSnapshot (orgSlug: string): Promise<OrgIndexPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const [projectsRes, workUnitLabel, labelsRes] = await Promise.all([
        api<{ data: OrgIndexProject[] }>(`/orgs/${slug}/projects`),
        fetchWorkUnitLabel(slug),
        api<{ data: OrgIndexLabel[] }>(`/orgs/${slug}/project-labels`),
      ])
      syncLabelState(slug, workUnitLabel)
      const snapshot: OrgIndexPageSnapshot = {
        projects: projectsRes.data,
        orgLabels: labelsRes.data,
        workUnitLabel,
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
  async function prefetch (orgSlug: string): Promise<OrgIndexPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): OrgIndexPageSnapshot | null {
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
