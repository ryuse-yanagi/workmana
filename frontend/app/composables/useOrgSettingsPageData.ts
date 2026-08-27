import type { SettingsLabelCategory, SettingsLabelTabKey, SettingsPageSnapshot } from '../components/settings/types'
import { normalizeSettingsLabelCategories } from '../components/settings/labelCategoryNormalize'
import { useApi } from './useApi'
import {
  clearAllOrgSettingsResourceCaches,
  invalidateOrgSettingsResource,
  setCachedOrgSettings,
  useOrgSettingsResource,
} from './useOrgSettingsResource'

const cacheBySlug = new Map<string, SettingsPageSnapshot>()
const inflightBySlug = new Map<string, Promise<SettingsPageSnapshot>>()

export function clearAllOrgSettingsPageCaches (): void {
  cacheBySlug.clear()
  inflightBySlug.clear()
  clearAllOrgSettingsResourceCaches()
}

export function useOrgSettingsPageData () {
  const { api } = useApi()
  const { fetchOrgSettings } = useOrgSettingsResource()

  async function fetchSnapshot (orgSlug: string, opts?: { refresh?: boolean }): Promise<SettingsPageSnapshot> {
    const slug = orgSlug.trim()
    if (opts?.refresh) {
      cacheBySlug.delete(slug)
      inflightBySlug.delete(slug)
    } else {
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
        fetchOrgSettings(slug, opts?.refresh ? { refresh: true } : undefined),
        api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/workspace-label-categories`),
        api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/task-label-categories`),
        api<{ data: SettingsLabelCategory[] }>(`/orgs/${slug}/document-label-categories`),
      ])
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

  function patchOrgSettingsCache (
    orgSlug: string,
    orgSettings: SettingsPageSnapshot['orgSettings'],
  ): void {
    const slug = orgSlug.trim()
    setCachedOrgSettings(slug, orgSettings)
    const existing = cacheBySlug.get(slug)
    if (!existing) {
      return
    }
    cacheBySlug.set(slug, {
      ...existing,
      orgSettings,
    })
  }

  function invalidateCached (orgSlug: string): void {
    const slug = orgSlug.trim()
    cacheBySlug.delete(slug)
    invalidateOrgSettingsResource(slug)
  }

  function clearAllCached (): void {
    clearAllOrgSettingsPageCaches()
  }

  return {
    fetchSnapshot,
    prefetch,
    getCached,
    getCachedLabelCategories,
    patchLabelCategoriesCache,
    patchOrgSettingsCache,
    invalidateCached,
    clearAllCached,
  }
}
