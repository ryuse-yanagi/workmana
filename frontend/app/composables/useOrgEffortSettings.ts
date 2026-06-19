import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import type { TaskFormEffortUnit } from './useTaskFormHelpers'
import { normalizeEffortUnit } from './useTaskFormHelpers'
import { useApi } from './useApi'

export type OrgEffortSettings = {
  effort_unit: TaskFormEffortUnit
}

type OrgEffortSettingsResponse = {
  effort_unit?: string | null
}

const STORAGE_KEY = 'tm:org-effort-settings'
const DEFAULT_EFFORT_UNIT: TaskFormEffortUnit = 'hour'

const settingsBySlug = reactive<Record<string, OrgEffortSettings>>({})
const settingsCache = new Map<string, OrgEffortSettings>()

function readStorageCache (): void {
  if (!import.meta.client) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, OrgEffortSettingsResponse>
    for (const [slug, settings] of Object.entries(parsed)) {
      const key = slug.trim()
      if (!key) continue
      const normalized = normalizeSettings(settings)
      settingsCache.set(key, normalized)
      settingsBySlug[key] = normalized
    }
  } catch {
    // ignore corrupt cache
  }
}

function writeStorageCache (): void {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(settingsCache)))
  } catch {
    // ignore quota / privacy errors
  }
}

function normalizeSettings (raw: OrgEffortSettingsResponse | null | undefined): OrgEffortSettings {
  return {
    effort_unit: normalizeEffortUnit(raw?.effort_unit),
  }
}

function syncEffortSettings (slug: string, settings: OrgEffortSettings): void {
  const key = slug.trim()
  if (!key) return
  settingsBySlug[key] = settings
  settingsCache.set(key, settings)
  writeStorageCache()
}

function getEffortSettingsState (slug: string): OrgEffortSettings | null {
  const key = slug.trim()
  if (!key) return null
  return settingsBySlug[key] ?? settingsCache.get(key) ?? null
}

export function hydrateOrgEffortSettingsCacheFromSession (): void {
  readStorageCache()
}

export function useOrgEffortSettings () {
  const { api } = useApi()

  async function fetchOrgEffortSettings (slug: string): Promise<OrgEffortSettings> {
    const res = await api<OrgEffortSettingsResponse>(`/orgs/${slug.trim()}/settings`)
    const settings = normalizeSettings(res)
    syncEffortSettings(slug, settings)
    return settings
  }

  async function ensureOrgEffortSettings (slug: string): Promise<OrgEffortSettings> {
    const key = slug.trim()
    const existing = getEffortSettingsState(key)
    if (existing) return existing
    return fetchOrgEffortSettings(key)
  }

  function getOrgEffortUnit (slug: string): TaskFormEffortUnit {
    return getEffortSettingsState(slug)?.effort_unit ?? DEFAULT_EFFORT_UNIT
  }

  return {
    fetchOrgEffortSettings,
    ensureOrgEffortSettings,
    syncEffortSettings,
    getOrgEffortUnit,
    DEFAULT_EFFORT_UNIT,
  }
}

export function useOrgEffortUnit (slug: MaybeRefOrGetter<string>) {
  const { ensureOrgEffortSettings } = useOrgEffortSettings()

  const orgEffortUnit = computed(() => {
    const key = toValue(slug).trim()
    if (!key) return DEFAULT_EFFORT_UNIT
    return getEffortSettingsState(key)?.effort_unit ?? DEFAULT_EFFORT_UNIT
  })

  async function ensureOrgEffortUnit (targetSlug?: string): Promise<TaskFormEffortUnit> {
    const key = (targetSlug ?? toValue(slug)).trim()
    if (!key) return DEFAULT_EFFORT_UNIT
    const settings = await ensureOrgEffortSettings(key)
    return settings.effort_unit
  }

  return {
    orgEffortUnit,
    ensureOrgEffortUnit,
  }
}
