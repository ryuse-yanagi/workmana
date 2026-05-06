import { useApi } from './useApi'

type OrganizationSettingsResponse = {
  work_unit_label?: string | null
}

const DEFAULT_WORK_UNIT_LABEL = 'プロジェクト'

export function useOrgTerminology () {
  const { api } = useApi()

  async function fetchWorkUnitLabel (slug: string): Promise<string> {
    const res = await api<OrganizationSettingsResponse>(`/orgs/${slug}/settings`)
    const label = (res.work_unit_label || '').trim()
    return label || DEFAULT_WORK_UNIT_LABEL
  }

  return {
    fetchWorkUnitLabel,
    DEFAULT_WORK_UNIT_LABEL,
  }
}
