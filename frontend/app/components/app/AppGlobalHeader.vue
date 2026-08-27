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
        <div class="notifications">
          <button
            type="button"
            class="nav-btn nav-btn--icon notifications-trigger"
            aria-label="通知"
            title="通知"
            :aria-expanded="notificationsOpen"
            @click.stop="toggleNotifications"
          >
            <Bell :size="30" :stroke-width="1.5" class="nav-btn__icon" aria-hidden="true" />
            <span v-if="unreadCount > 0" class="notifications-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </button>
        </div>
        <button
          type="button"
          class="nav-btn nav-btn--icon"
          :disabled="!orgSlug"
          aria-label="設定"
          title="設定"
          @pointerenter="prefetchOrgSettingsRoute"
          @focus="prefetchOrgSettingsRoute"
          @click="goOrgSettings"
        >
          <Settings :size="30" :stroke-width="1.5" class="nav-btn__icon" aria-hidden="true" />
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
              <p v-if="orgSwitchError" class="dropdown-section__error" role="alert">{{ orgSwitchError }}</p>
              <button
                v-for="org in organizations"
                :key="org.id"
                type="button"
                class="dropdown-item dropdown-item--org"
                :class="{ 'dropdown-item--active': org.slug === orgSlug }"
                :disabled="switchingOrg"
                @click="switchToOrganization(org)"
              >
                <MemberAvatar
                  :member="{ id: org.id, name: org.name, avatar_url: org.icon_url ?? null }"
                  size="xs"
                />
                <span>{{ org.name }}</span>
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

    <Teleport to="body">
      <Transition name="notifications-drawer">
        <div
          v-if="notificationsOpen"
          class="notifications-drawer-overlay"
          role="presentation"
          @mousedown="onNotificationsOverlayMouseDown"
        >
          <aside
            class="notifications-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="お知らせ"
          >
            <header class="notifications-drawer__header">
              <h2 class="notifications-drawer__title">お知らせ</h2>
              <button
                type="button"
                class="notifications-drawer__close"
                aria-label="閉じる"
                @click="closeNotifications"
              >
                <X :size="20" :stroke-width="2.25" aria-hidden="true" />
              </button>
            </header>
            <div class="notifications-drawer__body">
              <p v-if="notificationsLoading && !notifications.length" class="notifications-drawer__state">
                読み込み中…
              </p>
              <p v-else-if="notificationsError && !notifications.length" class="notifications-drawer__state notifications-drawer__state--error">
                {{ notificationsError }}
              </p>
              <p v-else-if="!notifications.length" class="notifications-drawer__state">
                通知はありません。
              </p>
              <template v-else>
                <p v-if="notificationsError" class="notifications-drawer__state notifications-drawer__state--error">
                  {{ notificationsError }}
                </p>
                <ul class="notifications-list">
                  <li v-for="item in notifications" :key="item.id">
                    <button
                      type="button"
                      class="notifications-item"
                      :class="{ 'notifications-item--unread': !item.read_at }"
                      @click="onNotificationClick(item)"
                    >
                      <span class="notifications-item__main">
                        <time class="notifications-item__time">{{ formatNotificationDate(item.created_at) }}</time>
                        <span class="notifications-item__text">{{ notificationLabel(item) }}</span>
                      </span>
                      <ChevronRight
                        :size="18"
                        :stroke-width="2"
                        class="notifications-item__chevron"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                </ul>
              </template>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<script setup lang="ts">
import { Bell, ChevronRight, FolderOpen, NotebookText, Settings, X } from 'lucide-vue-next'
import ProfileSettingsModal from '../modals/ProfileSettingsModal.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { useAuth } from '../../composables/useAuth'
import { useApi } from '../../composables/useApi'
import { useOrganizationContext, type OrganizationSummary } from '../../composables/useOrganizationContext'
import { useOrgPageCacheWarmup } from '../../composables/useOrgPageCacheWarmup'
import { clearSessionScopedCaches } from '../../composables/useSessionScopedCaches'
import { createOverlayBackdropClose } from '../../utils/uiInteraction'

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
const notificationsError = ref<string | null>(null)
let notificationsPollTimer: ReturnType<typeof setInterval> | null = null
const switchingOrg = ref(false)
const orgSwitchError = ref<string | null>(null)

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
    icon_url: org.icon_url ?? null,
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

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

function formatNotificationDate (iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? ''
  return `${y}/${m}/${d}(${weekday})`
}

async function loadNotifications () {
  notificationsLoading.value = true
  try {
    const res = await api<{ data: AppNotification[] }>('/notifications')
    notifications.value = res.data ?? []
    notificationsError.value = null
  } catch (e: unknown) {
    // 一時失敗で既存の一覧を消さない
    notificationsError.value = e instanceof Error ? e.message : '通知の取得に失敗しました'
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

async function onNotificationClick (item: AppNotification) {
  await markNotificationRead(item)
  closeNotifications()
  const slug = item.data?.organization_slug || orgSlug.value
  const workspaceId = item.data?.workspace_id
  const taskId = item.data?.task_id
  if (!slug || !workspaceId) {
    return
  }
  const query: Record<string, string> = {}
  if (typeof taskId === 'number' && Number.isFinite(taskId) && taskId > 0) {
    query.task = String(taskId)
  }
  await router.push({
    path: `/org/${slug}/workspaces/${workspaceId}`,
    query,
  })
}

function toggleMenu () {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) {
    closeNotifications()
  }
}

const {
  onOverlayMouseDown: onNotificationsOverlayMouseDown,
  resetOverlayBackdropClose: resetNotificationsOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: closeNotifications,
})

watch(notificationsOpen, (open) => {
  if (!open) {
    resetNotificationsOverlayBackdropClose()
  }
})

useDropdownEscapeClose(menuOpen, closeMenu)
useDropdownEscapeClose(notificationsOpen, closeNotifications)
useExclusivePopover(menuOpen, closeMenu)
useExclusivePopover(notificationsOpen, closeNotifications)

async function goWorkspaceList () {
  if (!orgSlug.value) return
  closeMenu()
  closeNotifications()
  await router.push(`/org/${orgSlug.value}/workspaces`)
}

async function goDocumentsList () {
  if (!orgSlug.value) return
  closeMenu()
  closeNotifications()
  await router.push(`/org/${orgSlug.value}/documents`)
}

function orgSettingsRoute (slug: string) {
  return { path: `/org/${slug}/settings`, query: { tab: 'default_board_lists' } }
}

/** 設定ページのルート chunk を先読み（遷移待ちの主因を温める） */
function prefetchOrgSettingsRoute () {
  if (!import.meta.client) return
  const slug = orgSlug.value
  if (!slug) return
  void preloadRouteComponents(orgSettingsRoute(slug)).catch(() => {})
}

function scheduleOrgSettingsRouteWarmup (slug: string) {
  if (!import.meta.client || !slug) return
  onNuxtReady(() => {
    const run = () => {
      void preloadRouteComponents(orgSettingsRoute(slug)).catch(() => {})
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => run())
      return
    }
    setTimeout(run, 1)
  })
}

async function goOrgSettings () {
  if (!orgSlug.value) return
  closeMenu()
  closeNotifications()
  // クリック時点でも先読みを走らせ、未 prefetch の場合の待ちを短縮する
  prefetchOrgSettingsRoute()
  await router.push(orgSettingsRoute(orgSlug.value))
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
  orgSwitchError.value = null
  try {
    await switchOrganization({ id: org.id, slug: org.slug })
    orgSlug.value = org.slug
    closeMenu()
    await router.push(orgTopPath(org.slug))
  } catch (e: unknown) {
    orgSwitchError.value = e instanceof Error ? e.message : '組織の切替に失敗しました'
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

function onOrgIconUpdated (e: Event) {
  const detail = (e as CustomEvent<{ slug?: string; icon_url?: string | null }>).detail
  const slug = detail?.slug
  if (!slug) {
    void refreshMeContext()
    return
  }
  organizations.value = organizations.value.map(org => (
    org.slug === slug ? { ...org, icon_url: detail.icon_url ?? null } : org
  ))
}

function onUserProfileUpdated (e: Event) {
  const detail = (e as CustomEvent<{ id?: number; name?: string; avatar_url?: string | null }>).detail
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
  if (!menuOpen.value) {
    return
  }
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

watch(
  orgSlug,
  (slug) => {
    if (slug) {
      scheduleOrgSettingsRouteWarmup(slug)
    }
  },
  { immediate: true },
)

onMounted(() => {
  void refreshMeContext()
  if (import.meta.client) {
    document.addEventListener('click', onDocClick)
    window.addEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
    window.addEventListener('tm:org-icon-updated', onOrgIconUpdated as EventListener)
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
    window.removeEventListener('tm:org-icon-updated', onOrgIconUpdated as EventListener)
    if (notificationsPollTimer) {
      clearInterval(notificationsPollTimer)
      notificationsPollTimer = null
    }
  }
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/app/AppGlobalHeader.scss"></style>
