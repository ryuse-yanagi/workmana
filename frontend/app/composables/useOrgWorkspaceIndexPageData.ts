import { useApi } from './useApi'
import { resolveLabelColors } from '../utils/colorPresetResolution'

export type OrgWorkspaceLabel = {
  id: number
  name: string
  color: string
  color_index?: number
}

export type OrgWorkspaceItem = {
  id: number
  name: string
  labels?: OrgWorkspaceLabel[]
}

export type OrgWorkspaceIndexPageSnapshot = {
  workspaces: OrgWorkspaceItem[]
  orgLabels: OrgWorkspaceLabel[]
}

const cacheBySlug = new Map<string, OrgWorkspaceIndexPageSnapshot>()
const inflightBySlug = new Map<string, Promise<OrgWorkspaceIndexPageSnapshot>>()

export function useOrgWorkspaceIndexPageData () {
  const { api } = useApi()

  async function fetchSnapshot (orgSlug: string): Promise<OrgWorkspaceIndexPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const [workspacesRes, labelsRes] = await Promise.all([
        api<{ data: OrgWorkspaceItem[] }>(`/orgs/${slug}/workspaces`),
        api<{ data: OrgWorkspaceLabel[] }>(`/orgs/${slug}/workspace-labels`),
      ])
      const snapshot: OrgWorkspaceIndexPageSnapshot = {
        workspaces: workspacesRes.data.map(workspace => ({
          ...workspace,
          labels: workspace.labels ? resolveLabelColors(workspace.labels) : workspace.labels,
        })),
        orgLabels: resolveLabelColors(labelsRes.data),
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

  async function prefetch (orgSlug: string): Promise<OrgWorkspaceIndexPageSnapshot> {
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): OrgWorkspaceIndexPageSnapshot | null {
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
