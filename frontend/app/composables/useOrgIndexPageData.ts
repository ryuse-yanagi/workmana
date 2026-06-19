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

export function useOrgIndexPageData () {
  const { api } = useApi()
  const { fetchWorkUnitLabel, syncLabelState } = useOrgTerminology()

  async function fetchSnapshot (orgSlug: string): Promise<OrgIndexPageSnapshot> {
    const slug = orgSlug.trim()
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
  }

  /** プロジェクト一覧へ遷移する前に呼ぶ（常に最新データを取得してキャッシュする） */
  async function prefetch (orgSlug: string): Promise<OrgIndexPageSnapshot> {
    await api('/me')
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
