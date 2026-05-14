<template>
  <header class="global-header">
    <div class="global-header__inner">
      <div class="global-header__left">
        <button type="button" class="nav-btn" :disabled="!orgSlug" @click="goProjectList">
          {{ workUnitListLabel }}
        </button>
        <button
          type="button"
          class="nav-btn nav-btn--icon"
          :disabled="!orgSlug"
          aria-label="設定"
          title="設定"
          @click="goSettingsProfile"
        >
          <Settings :size="18" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>

      <div class="global-header__right">
        <div class="profile" data-profile-root>
          <button type="button" class="profile-trigger" :aria-expanded="menuOpen" @click.stop="toggleMenu">
            <span class="avatar-btn">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" class="avatar-img" />
              <span v-else class="avatar-fallback">{{ initials }}</span>
            </span>
            <span class="profile-name">{{ displayName || 'ユーザー' }}</span>
          </button>

          <div v-if="menuOpen" class="dropdown" role="menu">
            <button type="button" class="dropdown-item" :disabled="!orgSlug" @click="goProfileFromMenu">
              プロフィール設定
            </button>
            <button type="button" class="dropdown-item danger" @click="logout">
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Settings } from 'lucide-vue-next'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type MeResponse = {
  name?: string | null
  email?: string | null
  avatar_url?: string | null
  organizations?: Array<{ slug: string; work_unit_label?: string | null }>
}

type OrgSettingsResponse = {
  work_unit_label?: string | null
}

const route = useRoute()
const router = useRouter()
const { api } = useApi()
const { getToken, clearToken, buildLogoutUrl } = useAuth()

const DEFAULT_WORK_UNIT_LABEL = 'プロジェクト'

const orgSlug = ref<string | null>(null)
const avatarUrl = ref<string | null>(null)
const displayName = ref('')
const menuOpen = ref(false)
const workUnitLabel = ref(DEFAULT_WORK_UNIT_LABEL)

const workUnitListLabel = computed(() => `${workUnitLabel.value}一覧`)

const initials = computed(() => {
  const source = (displayName.value || '').trim() || (route.path || '')
  if (!source) return '?'
  return source.slice(0, 1).toUpperCase()
})

function slugFromRoute (): string | null {
  const name = String(route.name || '')
  if (name === 'org-slug' || name === 'org-slug-settings' || name === 'org-slug-projects-id') {
    const s = route.params.slug
    return typeof s === 'string' && s.trim() ? s : null
  }
  return null
}

function normalizeWorkUnitLabel (raw: string | null | undefined): string {
  const label = (raw || '').trim()
  return label || DEFAULT_WORK_UNIT_LABEL
}

function workUnitLabelFromMe (me: MeResponse, slug: string | null): string {
  if (!slug) {
    return DEFAULT_WORK_UNIT_LABEL
  }
  const org = me.organizations?.find(o => o.slug === slug)
  return normalizeWorkUnitLabel(org?.work_unit_label)
}

async function refreshOrgWorkUnitLabel (slug: string | null): Promise<boolean> {
  if (!import.meta.client) {
    return false
  }
  if (!slug || !getToken()) {
    workUnitLabel.value = DEFAULT_WORK_UNIT_LABEL
    return false
  }

  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${slug}/settings`)
    workUnitLabel.value = normalizeWorkUnitLabel(res.work_unit_label)
    return true
  } catch {
    workUnitLabel.value = DEFAULT_WORK_UNIT_LABEL
    return false
  }
}

async function refreshMeContext () {
  if (!import.meta.client) {
    return
  }
  if (!getToken()) {
    orgSlug.value = slugFromRoute()
    avatarUrl.value = null
    displayName.value = ''
    workUnitLabel.value = DEFAULT_WORK_UNIT_LABEL
    return
  }

  const routeSlug = slugFromRoute()
  if (routeSlug) {
    orgSlug.value = routeSlug
  }

  try {
    const me = await api<MeResponse>('/me')
    displayName.value = (me.name || me.email || '').trim()
    avatarUrl.value = me.avatar_url || null
    if (!routeSlug) {
      const first = me.organizations?.[0]?.slug
      orgSlug.value = first && first.trim() ? first : null
    }

    const activeSlug = orgSlug.value
    if (activeSlug) {
      const ok = await refreshOrgWorkUnitLabel(activeSlug)
      if (!ok) {
        workUnitLabel.value = workUnitLabelFromMe(me, activeSlug)
      }
    } else {
      workUnitLabel.value = DEFAULT_WORK_UNIT_LABEL
    }
  } catch {
    // 認証失敗などは静かに無視（各画面でエラー表示）
    if (!routeSlug) {
      orgSlug.value = null
    }
    avatarUrl.value = null
    displayName.value = ''
    workUnitLabel.value = DEFAULT_WORK_UNIT_LABEL
  }
}

function closeMenu () {
  menuOpen.value = false
}

function toggleMenu () {
  menuOpen.value = !menuOpen.value
}

function goProjectList () {
  if (!orgSlug.value) return
  closeMenu()
  void router.push(`/org/${orgSlug.value}`)
}

function goSettingsProfile () {
  if (!orgSlug.value) return
  closeMenu()
  void router.push({ path: `/org/${orgSlug.value}/settings`, query: { tab: 'profile' } })
}

function goProfileFromMenu () {
  goSettingsProfile()
}

function logout () {
  closeMenu()
  clearToken()
  const url = buildLogoutUrl()
  if (url && import.meta.client) {
    window.location.href = url
    return
  }
  void router.push('/login')
}

function onWorkUnitLabelUpdated (e: Event) {
  const detail = (e as CustomEvent<{ slug?: string }>).detail
  const updatedSlug = (detail?.slug || '').trim()
  if (!updatedSlug) {
    return
  }
  if (orgSlug.value && orgSlug.value !== updatedSlug) {
    return
  }
  void refreshOrgWorkUnitLabel(updatedSlug)
}

function onUserProfileUpdated (e: Event) {
  const detail = (e as CustomEvent<{ name?: string }>).detail
  const name = (detail?.name || '').trim()
  if (name) {
    displayName.value = name
    return
  }
  void refreshMeContext()
}

function onDocClick (e: MouseEvent) {
  if (!menuOpen.value) return
  const target = e.target as Node | null
  const root = document.querySelector('[data-profile-root]')
  if (root && target && !root.contains(target)) {
    closeMenu()
  }
}

watch(
  () => route.fullPath,
  () => {
    void refreshMeContext()
  },
)

onMounted(() => {
  void refreshMeContext()
  if (import.meta.client) {
    document.addEventListener('click', onDocClick)
    window.addEventListener('tm:org-work-unit-label-updated', onWorkUnitLabelUpdated as EventListener)
    window.addEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('tm:org-work-unit-label-updated', onWorkUnitLabelUpdated as EventListener)
    window.removeEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
  }
})
</script>

<style scoped>
.global-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(15, 23, 42, 0.35);
  background: #0b2bab;
  backdrop-filter: blur(10px);
}

.global-header__inner {
  width: 100%;
  padding: 0.55rem 0.9rem;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 0.75rem;
  box-sizing: border-box;
  min-width: 0;
}

.global-header__left {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.global-header__right {
  display: flex;
  align-items: flex-end;
  margin-left: auto;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
}

.nav-btn {
  margin-top: 0.3rem;
  border: none;
  background: #0b2bab;
  color: #f8fafc;
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  min-height: 2.25rem;
  font-size: 1.05rem;
  line-height: 1.1;
  font-weight: 500;
  cursor: pointer;
}

.nav-btn--icon {
  width: 2.25rem;
  padding: 0;
  justify-content: center;
}

.nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.profile {
  position: relative;
  max-width: 100%;
}

.profile-trigger {
  border: none;
  background: transparent;
  color: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  cursor: pointer;
  padding: 0;
  min-width: 0;
  max-width: min(100%, 26rem);
}

.avatar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  padding: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
}

.profile-name {
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.1;
  color: #f8fafc;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: 900;
  color: #f8fafc;
}

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 0.45rem);
  width: 14rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  padding: 0.35rem;
}

.dropdown-item {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  font-weight: 800;
  color: #0f172a;
  cursor: pointer;
}

.dropdown-item:hover {
  background: #f1f5f9;
}

.dropdown-item.danger {
  color: #b91c1c;
}

.dropdown-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
