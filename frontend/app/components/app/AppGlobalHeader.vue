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
import { clearSessionScopedCaches } from '../../composables/useSessionScopedCaches'

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
  clearSessionScopedCaches()
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

<style lang="scss" scoped src="~/assets/styles/components/app/AppGlobalHeader.scss"></style>
