import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import { useApi } from './useApi'

type OrganizationSettingsResponse = {
  work_unit_label?: string | null
}

type OrganizationLabelSeed = {
  slug: string
  work_unit_label?: string | null
}

const DEFAULT_WORK_UNIT_LABEL = 'プロジェクト'
const STORAGE_KEY = 'tm:work-unit-labels'

const labelBySlug = reactive<Record<string, string>>({})
const labelCache = new Map<string, string>()

function readStorageCache (): void {
  if (!import.meta.client) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [slug, label] of Object.entries(parsed)) {
      const trimmed = (label || '').trim()
      if (!slug.trim() || !trimmed) continue
      labelCache.set(slug, trimmed)
      labelBySlug[slug] = trimmed
    }
  } catch {
    // ignore corrupt cache
  }
}

function writeStorageCache (): void {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(labelCache)))
  } catch {
    // ignore quota / privacy errors
  }
}

function normalizeWorkUnitLabel (raw: string | null | undefined): string {
  const label = (raw || '').trim()
  return label || DEFAULT_WORK_UNIT_LABEL
}

function syncLabelState (slug: string, label: string): void {
  const key = slug.trim()
  const value = normalizeWorkUnitLabel(label)
  if (!key) return
  labelBySlug[key] = value
  labelCache.set(key, value)
  writeStorageCache()
}

function getWorkUnitLabelState (slug: string): string | null {
  const key = slug.trim()
  if (!key) return null
  return labelBySlug[key] ?? labelCache.get(key) ?? null
}

/** ハイドレーション後に sessionStorage から復元（SSR と初回描画の不一致を防ぐ） */
export function hydrateWorkUnitLabelCacheFromSession (): void {
  readStorageCache()
}

export function useOrgTerminology () {
  const { api } = useApi()

  async function fetchWorkUnitLabel (slug: string): Promise<string> {
    const res = await api<OrganizationSettingsResponse>(`/orgs/${slug}/settings`)
    const label = normalizeWorkUnitLabel(res.work_unit_label)
    syncLabelState(slug, label)
    return label
  }

  function seedWorkUnitLabels (organizations: OrganizationLabelSeed[] | undefined): void {
    for (const org of organizations ?? []) {
      const slug = (org.slug || '').trim()
      if (!slug) continue
      syncLabelState(slug, org.work_unit_label ?? DEFAULT_WORK_UNIT_LABEL)
    }
  }

  return {
    fetchWorkUnitLabel,
    seedWorkUnitLabels,
    syncLabelState,
    getWorkUnitLabelState,
    DEFAULT_WORK_UNIT_LABEL,
  }
}

export function useWorkUnitLabel (slug: MaybeRefOrGetter<string>) {
  const { fetchWorkUnitLabel } = useOrgTerminology()

  const workUnitLabel = computed(() => {
    const key = toValue(slug).trim()
    if (!key) return null
    return getWorkUnitLabelState(key) ?? DEFAULT_WORK_UNIT_LABEL
  })

  const workUnitListLabel = computed(() => {
    const key = toValue(slug).trim()
    if (!key) return ''
    const label = getWorkUnitLabelState(key) ?? DEFAULT_WORK_UNIT_LABEL
    return `${label}一覧`
  })

  async function ensureWorkUnitLabel (targetSlug?: string): Promise<string> {
    const key = (targetSlug ?? toValue(slug)).trim()
    if (!key) return DEFAULT_WORK_UNIT_LABEL

    const existing = getWorkUnitLabelState(key)
    if (existing) return existing

    return fetchWorkUnitLabel(key)
  }

  return {
    workUnitLabel,
    workUnitListLabel,
    ensureWorkUnitLabel,
  }
}
