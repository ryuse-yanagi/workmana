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
        <div class="notifications" data-notifications-root>
          <button
            type="button"
            class="nav-btn nav-btn--icon notifications-trigger"
            aria-label="通知"
            title="通知"
            :aria-expanded="notificationsOpen"
            @click.stop="toggleNotifications"
          >
            <Bell :size="24" :stroke-width="2.25" aria-hidden="true" />
            <span v-if="unreadCount > 0" class="notifications-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </button>
          <div v-if="notificationsOpen" class="dropdown notifications-dropdown" role="menu">
            <div class="notifications-dropdown__header">
              <span>通知</span>
              <button
                type="button"
                class="notifications-dropdown__read-all"
                :disabled="!unreadCount || notificationsLoading"
                @click="markAllNotificationsRead"
              >
                すべて既読
              </button>
            </div>
            <p v-if="notificationsLoading && !notifications.length" class="notifications-dropdown__state">
              読み込み中…
            </p>
            <p v-else-if="!notifications.length" class="notifications-dropdown__state">
              通知はありません。
            </p>
            <ul v-else class="notifications-list">
              <li v-for="item in notifications" :key="item.id">
                <button
                  type="button"
                  class="notifications-item"
                  :class="{ 'notifications-item--unread': !item.read_at }"
                  @click="onNotificationClick(item)"
                >
                  <span class="notifications-item__text">{{ notificationLabel(item) }}</span>
                  <time class="notifications-item__time">{{ formatNotificationTime(item.created_at) }}</time>
                </button>
              </li>
            </ul>
          </div>
        </div>
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
            <div v-if="organizations.length" class="dropdown-section">
              <p class="dropdown-section__label">組織を切替</p>
              <button
                v-for="org in organizations"
                :key="org.id"
                type="button"
                class="dropdown-item"
                :class="{ 'dropdown-item--active': org.slug === orgSlug }"
                @click="switchToOrganization(org)"
              >
                {{ org.name }}
              </button>
            </div>
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
import { Bell, FolderOpen, NotebookText, Settings } from 'lucide-vue-next'
import ProfileSettingsModal from '../modals/ProfileSettingsModal.vue'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useAuth } from '../../composables/useAuth'
import { useApi } from '../../composables/useApi'
import { useOrganizationContext, type OrganizationSummary } from '../../composables/useOrganizationContext'
import { useOrgPageCacheWarmup } from '../../composables/useOrgPageCacheWarmup'
import { clearSessionScopedCaches } from '../../composables/useSessionScopedCaches'

type AppNotification = {
  id: number
  type: string
  data: {
    task_id?: number
    workspace_id?: number
    organization_slug?: string
    title?: string
  } | null
  read_at: string | null
  created_at: string
}

const route = useRoute()
const router = useRouter()
const { fetchSession, logout: endSession } = useAuth()
const { api } = useApi()
const { switchOrganization, orgTopPath } = useOrganizationContext()
const { warmOrgPageCaches } = useOrgPageCacheWarmup()

const orgSlug = ref<string | null>(slugFromRoute())
const organizations = ref<OrganizationSummary[]>([])
const avatarUrl = ref<string | null>(null)
const displayName = ref('')
const menuOpen = ref(false)
const profileModalOpen = ref(false)
const notificationsOpen = ref(false)
const notifications = ref<AppNotification[]>([])
const notificationsLoading = ref(false)
let notificationsPollTimer: ReturnType<typeof setInterval> | null = null
const switchingOrg = ref(false)

const unreadCount = computed(() => notifications.value.filter(item => !item.read_at).length)

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
  const routeSlug = slugFromRoute()
  if (routeSlug) {
    orgSlug.value = routeSlug
  }

  // 未ログインでも 200 が返るセッション API で判定する
  const me = (await fetchSession()).user

  if (!me) {
    if (!routeSlug) {
      orgSlug.value = null
    }
    organizations.value = []
    avatarUrl.value = null
    displayName.value = ''
    return
  }

  displayName.value = (me.name || me.email || '').trim()
  avatarUrl.value = me.avatar_url || null
  organizations.value = (me.organizations ?? []).map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.role,
  }))
  if (!routeSlug) {
    const lastId = me.last_organization_id
    const last = lastId != null
      ? organizations.value.find(org => org.id === lastId)
      : null
    const first = last ?? organizations.value[0]
    orgSlug.value = first?.slug?.trim() ? first.slug : null
  }

  const activeSlug = orgSlug.value
  if (activeSlug) {
    void warmOrgPageCaches(activeSlug)
  }
}

function closeMenu () {
  menuOpen.value = false
}

function closeNotifications () {
  notificationsOpen.value = false
}

function toggleNotifications () {
  notificationsOpen.value = !notificationsOpen.value
  if (notificationsOpen.value) {
    closeMenu()
    void loadNotifications()
  }
}

function notificationLabel (item: AppNotification): string {
  const title = item.data?.title?.trim() || 'タスク'
  if (item.type === 'task.assigned') {
    return `「${title}」に担当者として追加されました`
  }
  if (item.type === 'task.mentioned') {
    return `「${title}」でメンションされました`
  }
  if (item.type === 'task.commented') {
    return `「${title}」にコメントがありました`
  }
  return title
}

function formatNotificationTime (iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadNotifications () {
  notificationsLoading.value = true
  try {
    const res = await api<{ data: AppNotification[] }>('/notifications')
    notifications.value = res.data ?? []
  } catch {
    notifications.value = []
  } finally {
    notificationsLoading.value = false
  }
}

async function markNotificationRead (item: AppNotification) {
  if (item.read_at) return
  try {
    const updated = await api<AppNotification>(`/notifications/${item.id}/read`, {
      method: 'PATCH',
    })
    notifications.value = notifications.value.map(row => (
      row.id === item.id ? { ...row, ...updated } : row
    ))
  } catch {
    // ignore
  }
}

async function markAllNotificationsRead () {
  if (!unreadCount.value) return
  try {
    await api('/notifications/read-all', { method: 'POST' })
    const now = new Date().toISOString()
    notifications.value = notifications.value.map(item => ({
      ...item,
      read_at: item.read_at ?? now,
    }))
  } catch {
    // ignore
  }
}

async function onNotificationClick (item: AppNotification) {
  await markNotificationRead(item)
  closeNotifications()
  const slug = item.data?.organization_slug || orgSlug.value
  const workspaceId = item.data?.workspace_id
  if (slug && workspaceId) {
    await router.push(`/org/${slug}/workspaces/${workspaceId}`)
  }
}

function toggleMenu () {
  menuOpen.value = !menuOpen.value
}

useDropdownEscapeClose(menuOpen, closeMenu)
useDropdownEscapeClose(notificationsOpen, closeNotifications)

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

async function switchToOrganization (org: OrganizationSummary) {
  if (switchingOrg.value) return
  if (org.slug === orgSlug.value) {
    closeMenu()
    return
  }
  switchingOrg.value = true
  closeMenu()
  try {
    await switchOrganization({ id: org.id, slug: org.slug })
    orgSlug.value = org.slug
    await router.push(orgTopPath(org.slug))
  } catch {
    // 切替失敗時は現在の組織のまま
  } finally {
    switchingOrg.value = false
  }
}

async function logout () {
  closeMenu()
  clearSessionScopedCaches()
  // セッション Cookie の破棄はバックエンドが行う
  await endSession()
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
  const target = e.target as Node | null
  if (menuOpen.value) {
    const root = document.querySelector('[data-profile-root]')
    if (root && target && !root.contains(target)) {
      closeMenu()
    }
  }
  if (notificationsOpen.value) {
    const root = document.querySelector('[data-notifications-root]')
    if (root && target && !root.contains(target)) {
      closeNotifications()
    }
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
    void loadNotifications()
    notificationsPollTimer = setInterval(() => {
      void loadNotifications()
    }, 60_000)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
    if (notificationsPollTimer) {
      clearInterval(notificationsPollTimer)
      notificationsPollTimer = null
    }
  }
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/app/AppGlobalHeader.scss"></style>
