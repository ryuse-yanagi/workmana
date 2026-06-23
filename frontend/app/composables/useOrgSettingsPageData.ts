import type { SettingsPageSnapshot } from '../components/settings/types'
import { normalizeEffortUnit } from './useTaskFormHelpers'
import { useApi } from './useApi'
import { useOrgEffortSettings } from './useOrgEffortSettings'
import { useOrgTerminology } from './useOrgTerminology'

const cacheBySlug = new Map<string, SettingsPageSnapshot>()
const inflightBySlug = new Map<string, Promise<SettingsPageSnapshot>>()

export function useOrgSettingsPageData () {
  const { api } = useApi()
  const { syncLabelState, DEFAULT_WORK_UNIT_LABEL } = useOrgTerminology()
  const { syncEffortSettings } = useOrgEffortSettings()

  async function fetchSnapshot (orgSlug: string): Promise<SettingsPageSnapshot> {
    const slug = orgSlug.trim()
    const inflight = inflightBySlug.get(slug)
    if (inflight) {
      return inflight
    }

    const job = (async () => {
      const [orgSettings, projectLabelsRes, taskLabelsRes] = await Promise.all([
        api<SettingsPageSnapshot['orgSettings']>(`/orgs/${slug}/settings`),
        api<{ data: SettingsPageSnapshot['projectLabels'] }>(`/orgs/${slug}/project-labels`),
        api<{ data: SettingsPageSnapshot['taskLabels'] }>(`/orgs/${slug}/task-labels`),
      ])
      const label = (orgSettings.work_unit_label || '').trim() || DEFAULT_WORK_UNIT_LABEL
      syncLabelState(slug, label)
      syncEffortSettings(slug, {
        effort_unit: normalizeEffortUnit(orgSettings.effort_unit),
      })
      const snapshot: SettingsPageSnapshot = {
        orgSettings,
        projectLabels: projectLabelsRes.data,
        taskLabels: taskLabelsRes.data,
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
    DEFAULT_WORK_UNIT_LABEL,
  }
}
