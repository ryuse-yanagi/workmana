import type { SettingsLabelCategory, SettingsLabelTabKey, SettingsPageSnapshot } from '../components/settings/types'
import { normalizeSettingsLabelCategories } from '../components/settings/labelCategoryNormalize'
import { normalizeEffortUnit } from './useTaskFormHelpers'
import { useApi } from './useApi'
import { useOrgEffortSettings } from './useOrgEffortSettings'

const cacheBySlug = new Map<string, SettingsPageSnapshot>()
const inflightBySlug = new Map<string, Promise<SettingsPageSnapshot>>()

export function useOrgSettingsPageData () {
  const { api } = useApi()
  const { syncEffortSettings } = useOrgEffortSettings()

  async function fetchSnapshot (orgSlug: string, opts?: { refresh?: boolean }): Promise<SettingsPageSnapshot> {
    const slug = orgSlug.trim()
    if (!opts?.refresh) {
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
      const [orgSettings, workspaceLabelCategoriesRes, taskLabelCategoriesRes, documentLabelCategoriesRes] = await Promise.all([
        api<SettingsPageSnapshot['orgSettings']>(`/orgs/${slug}/settings`),
        api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/workspace-label-categories`),
        api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/task-label-categories`),
        api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/document-label-categories`),
      ])
      syncEffortSettings(slug, {
        effort_unit: normalizeEffortUnit(orgSettings.effort_unit),
      })
      const snapshot: SettingsPageSnapshot = {
        orgSettings,
        workspaceLabelCategories: normalizeSettingsLabelCategories(workspaceLabelCategoriesRes.data),
        taskLabelCategories: normalizeSettingsLabelCategories(taskLabelCategoriesRes.data),
        documentLabelCategories: normalizeSettingsLabelCategories(documentLabelCategoriesRes.data),
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
    return fetchSnapshot(orgSlug)
  }

  function getCached (orgSlug: string): SettingsPageSnapshot | null {
    return cacheBySlug.get(orgSlug.trim()) ?? null
  }

  function getCachedLabelCategories (
    orgSlug: string,
    labelKind: SettingsLabelTabKey,
  ): SettingsLabelCategory[] | null {
    const snapshot = getCached(orgSlug)
    if (!snapshot) {
      return null
    }
    return labelKind === 'workspace'
      ? snapshot.workspaceLabelCategories
      : labelKind === 'task'
        ? snapshot.taskLabelCategories
        : snapshot.documentLabelCategories
  }

  function patchLabelCategoriesCache (
    orgSlug: string,
    labelKind: SettingsLabelTabKey,
    categories: SettingsLabelCategory[],
  ): void {
    const slug = orgSlug.trim()
    const existing = cacheBySlug.get(slug)
    if (!existing) {
      return
    }
    cacheBySlug.set(slug, {
      ...existing,
      ...(labelKind === 'workspace'
        ? { workspaceLabelCategories: categories }
        : labelKind === 'task'
          ? { taskLabelCategories: categories }
          : { documentLabelCategories: categories }),
    })
  }

  function invalidateCached (orgSlug: string): void {
    cacheBySlug.delete(orgSlug.trim())
  }

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    getCachedLabelCategories,
    patchLabelCategoriesCache,
    invalidateCached,
  }
}
