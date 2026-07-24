<template>
  <header class="global-header">
    <div class="global-header__inner">
      <div class="global-header__left">
        <button type="button" class="nav-btn" :disabled="!orgSlug" @click="goWorkspaceList">
          <FolderOpen :size="20" :stroke-width="2.25" class="nav-btn__icon" aria-hidden="true" />
          Workspaces
        </button>
        <button type="button" class="nav-btn" :disabled="!orgSlug" @click="goDocumentsList">
          <NotebookText :size="20" :stroke-width="2.25" class="nav-btn__icon" aria-hidden="true" />
          Documents
        </button>
      </div>

      <div class="global-header__right">
        <button
          type="button"
          class="nav-btn nav-btn--icon"
          :disabled="!orgSlug"
          aria-label="設定"
          title="設定"
          @click="goOrgSettings"
        >
          <Settings :size="24" :stroke-width="2.25" aria-hidden="true" />
        </button>
        <span class="global-header__divider" aria-hidden="true" />
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

    <ProfileSettingsModal v-model="profileModalOpen" />
  </header>
</template>

<script setup lang="ts">
import { FolderOpen, NotebookText, Settings } from 'lucide-vue-next'
import ProfileSettingsModal from '../modals/ProfileSettingsModal.vue'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useApi } from '../../composables/useApi'
import { useAuth } from '../../composables/useAuth'
import { useOrgPageCacheWarmup } from '../../composables/useOrgPageCacheWarmup'

type MeResponse = {
  name?: string | null
  email?: string | null
  avatar_url?: string | null
  organizations?: Array<{ slug: string; role?: string }>
}

const route = useRoute()
const router = useRouter()
const { api } = useApi()
const { getToken, clearToken, buildLogoutUrl } = useAuth()
const { warmOrgPageCaches } = useOrgPageCacheWarmup()

const orgSlug = ref<string | null>(slugFromRoute())
const avatarUrl = ref<string | null>(null)
const displayName = ref('')
const menuOpen = ref(false)
const profileModalOpen = ref(false)

const initials = computed(() => {
  const source = (displayName.value || '').trim() || (route.path || '')
  if (!source) return '?'
  return source.slice(0, 1).toUpperCase()
})

function slugFromRoute (): string | null {
  const name = String(route.name || '')
  if (
    name === 'org-slug-workspaces'
    || name === 'org-slug-documents'
    || name === 'org-slug-documents-id'
    || name === 'org-slug-settings'
    || name === 'org-slug-workspaces-id'
  ) {
    const s = route.params.slug
    return typeof s === 'string' && s.trim() ? s : null
  }
  return null
}

async function refreshMeContext () {
  if (!import.meta.client) {
    return
  }
  if (!getToken()) {
    orgSlug.value = slugFromRoute()
    avatarUrl.value = null
    displayName.value = ''
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
      void warmOrgPageCaches(activeSlug)
    }
  } catch {
    if (!routeSlug) {
      orgSlug.value = null
    }
    avatarUrl.value = null
    displayName.value = ''
  }
}

function closeMenu () {
  menuOpen.value = false
}

function toggleMenu () {
  menuOpen.value = !menuOpen.value
}

useDropdownEscapeClose(menuOpen, closeMenu)

async function goWorkspaceList () {
  if (!orgSlug.value) return
  closeMenu()
  await router.push(`/org/${orgSlug.value}/workspaces`)
}

async function goDocumentsList () {
  if (!orgSlug.value) return
  closeMenu()
  await router.push(`/org/${orgSlug.value}/documents`)
}

async function goOrgSettings () {
  if (!orgSlug.value) return
  closeMenu()
  await router.push({ path: `/org/${orgSlug.value}/settings`, query: { tab: 'default_board_lists' } })
}

function goProfileFromMenu () {
  closeMenu()
  profileModalOpen.value = true
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

function onUserProfileUpdated (e: Event) {
  const detail = (e as CustomEvent<{ name?: string; avatar_url?: string | null }>).detail
  const name = (detail?.name || '').trim()
  if (name) {
    displayName.value = name
  }
  if (detail && 'avatar_url' in detail) {
    avatarUrl.value = detail.avatar_url || null
    return
  }
  if (name) {
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
    window.addEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
  }
})
</script>

<style lang="scss" scoped>
.global-header {
  @include mixin.header-font;
  --global-header-bg: #28384a;
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--tm-global-header-height, 56px);
  box-sizing: border-box;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: var(--global-header-bg);
}

.global-header__inner {
  width: 100%;
  height: 100%;
  padding: 0 11.9px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 9.1px;
  box-sizing: border-box;
  min-width: 0;
}

.global-header__left {
  display: flex;
  align-items: center;
  gap: 9.1px;
  flex-wrap: wrap;
  min-width: 0;
}

.global-header__right {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: auto;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
}

.global-header__divider {
  flex-shrink: 0;
  width: 1.2px;
  height: 28px;
  margin: 0 15.4px;
  background: rgba(255, 255, 255, 0.38);
}

.nav-btn {
  border: none;
  background: var(--global-header-bg);
  color: #f8fafc;
  border-radius: 999px;
  padding: 4.9px 9.8px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 5.6px;
  font-size: mixin.$header-nav-label-font-size;
  font-weight: mixin.$header-nav-label-font-weight;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.nav-btn__icon {
  flex-shrink: 0;
  display: block;
}

.nav-btn--icon {
  width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 0;
  justify-content: center;
}

.nav-btn:disabled {
  opacity: 0.45;
}

.profile {
  position: relative;
  max-width: 100%;
}

.profile-trigger {
  border: none;
  background: var(--global-header-bg);
  color: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6.3px;
  cursor: pointer;
  padding: 0;
  min-width: 0;
  max-width: min(100%, 364px);
}

.avatar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  padding: 0;
  overflow: hidden;
  background: var(--global-header-bg);
  cursor: pointer;
}

.profile-name {
  font-size: 14px;
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
  top: calc(100% + 6.3px);
  width: 196px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  padding: 4.9px;
}

.dropdown-item {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 7.7px 9.1px;
  border-radius: 8px;
  font-weight: 800;
  color: #0f172a;
  cursor: pointer;
}


.dropdown-item.danger {
  color: mixin.$danger;
}

.dropdown-item:disabled {
  opacity: 0.45;
}
</style>
