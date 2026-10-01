<template>
  <header class="global-header">
    <div class="global-header__inner">
      <div class="global-header__left">
        <img
          class="global-header__brand"
          src="~/assets/images/brand-icon.svg"
          width="40"
          height="40"
          alt="WorkMana"
        >
        <button type="button" class="nav-btn" :disabled="!orgSlug" @click="goWorkspaceList">
          <FolderOpen :size="20" :stroke-width="2.25" class="nav-btn__icon" aria-hidden="true" />
          Workspaces
        </button>
      </div>

      <div class="global-header__right">
        <div class="notifications">
          <button
            type="button"
            class="nav-btn nav-btn--icon notifications-trigger"
            data-popover-trigger
            aria-label="通知"
            title="通知"
            :aria-expanded="notificationsOpen"
            @click.stop="toggleNotifications"
          >
            <Bell :size="30" :stroke-width="1.5" class="nav-btn__icon" aria-hidden="true" />
            <Circle
              v-if="unreadCount > 0"
              class="notifications-badge"
              :size="12"
              :stroke-width="2"
              aria-hidden="true"
            />
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
          <button type="button" class="profile-trigger" data-popover-trigger :aria-expanded="menuOpen" @click.stop="toggleMenu">
            <span class="avatar-btn">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" class="avatar-img" />
              <span v-else class="avatar-fallback">{{ initials }}</span>
            </span>
            <span class="profile-name">{{ displayName }}</span>
          </button>

          <Transition name="popover-fade">
          <div v-if="menuOpen" class="dropdown" data-popover-panel role="menu">
            <div v-if="organizations.length" class="dropdown-section" role="presentation">
              <p class="dropdown-section__label">組織の切替</p>
              <p v-if="orgSwitchError" class="dropdown-section__error" role="alert">{{ orgSwitchError }}</p>
              <div class="dropdown-orgs" role="group" aria-label="組織の切替">
                <button
                  v-for="org in organizations"
                  :key="org.id"
                  type="button"
                  class="dropdown-item dropdown-item--org"
                  :class="{ 'dropdown-item--active': org.slug === orgSlug }"
                  :disabled="switchingOrg"
                  role="menuitemradio"
                  :aria-checked="org.slug === orgSlug"
                  @click="switchToOrganization(org)"
                >
                  <MemberAvatar
                    :member="{ id: org.id, name: org.name, avatar_url: org.icon_url ?? null }"
                    size="sm"
                  />
                  <span class="dropdown-item__label">{{ org.name }}</span>
                  <Check
                    v-if="org.slug === orgSlug"
                    :size="16"
                    :stroke-width="2.5"
                    class="dropdown-item__check"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <button type="button" class="dropdown-item" role="menuitem" @click="goCreateOrganization">
                <Plus :size="16" :stroke-width="2" class="dropdown-item__icon" aria-hidden="true" />
                <span class="dropdown-item__label">組織の作成</span>
              </button>
            </div>
            <div class="dropdown-actions" role="presentation">
              <button type="button" class="dropdown-item" role="menuitem" :disabled="!orgSlug" @click="goProfileFromMenu">
                <UserRound :size="16" :stroke-width="2" class="dropdown-item__icon" aria-hidden="true" />
                <span class="dropdown-item__label">プロフィール設定</span>
              </button>
              <p v-if="logoutError" class="dropdown-section__error" role="alert">{{ logoutError }}</p>
              <button type="button" class="dropdown-item dropdown-item--danger" role="menuitem" :disabled="loggingOut" @click="logout">
                <LogOut :size="16" :stroke-width="2" class="dropdown-item__icon" aria-hidden="true" />
                <span class="dropdown-item__label">ログアウト</span>
              </button>
            </div>
          </div>
          </Transition>
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
            ref="notificationsDrawerRef"
            class="notifications-drawer"
            :style="notificationsDrawerStyle"
            role="dialog"
            aria-modal="true"
            aria-label="通知"
          >
            <header class="notifications-drawer__header">
              <h2 class="notifications-drawer__title">通知</h2>
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
                        <span class="notifications-item__meta">
                          <time class="notifications-item__time">{{ formatNotificationDate(item.created_at) }}</time>
                          <span v-if="!item.read_at" class="notifications-item__unread">未読</span>
                        </span>
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
import { Bell, Check, ChevronRight, Circle, FolderOpen, LogOut, Plus, Settings, UserRound, X } from 'lucide-vue-next'
import ProfileSettingsModal from '../modals/settings/ProfileSettingsModal.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import { useDropdownEscapeClose } from '../../composables/ui/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/ui/useExclusivePopover'
import { useModalScrollbarGutter } from '../../composables/ui/useModalScrollbarGutter'
import { useAuth } from '../../composables/auth/useAuth'
import { UnsavedDiscardError } from '../../composables/shared/useUnsavedChangesGuard'
import { useApi } from '../../composables/shared/useApi'
import { useOrganizationContext, type OrganizationSummary } from '../../composables/org/useOrganizationContext'
import { useOrgPageCacheWarmup } from '../../composables/org/useOrgPageCacheWarmup'
import { createOverlayBackdropClose } from '../../utils/ui/uiInteraction'
import { workspaceViewFromRoute } from '../../composables/workspace/useWorkspaceViewRoutes'

type AppNotification = {
  id: number
  type: string
  data: {
    task_id?: number
    workspace_id?: number
    workspace_name?: string
    organization_slug?: string
    organization_name?: string
    title?: string
    parent_task_title?: string | null
    due_date?: string | null
    due_date_change?: 'set' | 'changed' | 'cleared'
    role?: string
    invite_token?: string
  } | null
  read_at: string | null
  created_at: string
}

const route = useRoute()
const router = useRouter()
const { session, fetchSession, patchSessionUser, logout: endSession } = useAuth()
const { api } = useApi()
const { switchOrganization, orgTopPath } = useOrganizationContext()
const { warmOrgPageCaches } = useOrgPageCacheWarmup()

const orgSlug = ref<string | null>(slugFromRoute())
const organizations = computed<OrganizationSummary[]>(() => (
  (session.value?.user?.organizations ?? []).map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.role,
    icon_url: org.icon_url ?? null,
  }))
))
const avatarUrl = computed(() => session.value?.user?.avatar_url || null)
const displayName = computed(() => {
  const me = session.value?.user
  if (!me) {
    return ''
  }
  return (me.name || me.email || '').trim() || 'ユーザー'
})
const menuOpen = ref(false)
const profileModalOpen = ref(false)
const notificationsOpen = ref(false)
const notifications = ref<AppNotification[]>([])
const notificationsLoading = ref(false)
const notificationsError = ref<string | null>(null)
const notificationsDrawerRef = ref<HTMLElement | null>(null)
const {
  scrollbarStyle: notificationsScrollbarStyle,
  syncModalScrollbarGutter: syncNotificationsScrollbarGutter,
} = useModalScrollbarGutter({
  cardRef: notificationsDrawerRef,
  open: notificationsOpen,
  width: () => 'min(420px, 100%)',
  scrollerSelector: '.notifications-drawer__body',
})
const notificationsDrawerStyle = computed(() => notificationsScrollbarStyle.value)
let notificationsPollTimer: ReturnType<typeof setInterval> | null = null
const switchingOrg = ref(false)
const orgSwitchError = ref<string | null>(null)
const loggingOut = ref(false)
const logoutError = ref<string | null>(null)

const unreadCount = computed(() => notifications.value.filter(item => !item.read_at).length)

const initials = computed(() => {
  const source = displayName.value.trim()
  if (!source) return '?'
  return source.slice(0, 1).toUpperCase()
})

function slugFromRoute (): string | null {
  const name = String(route.name || '')
  if (
    name === 'org-slug-workspaces'
    || name === 'org-slug-workspaces-id-documents-documentId'
    || name === 'org-slug-settings'
    || name === 'org-slug-workspaces-id'
  ) {
    const s = route.params.slug
    return typeof s === 'string' && s.trim() ? s : null
  }
  return null
}

function applyOrgSlugFromSession (me: { last_organization_id?: number | null } | null, routeSlug: string | null) {
  if (routeSlug) {
    orgSlug.value = routeSlug
    return
  }
  if (!me) {
    orgSlug.value = null
    return
  }
  const lastId = me.last_organization_id
  const last = lastId != null
    ? organizations.value.find(org => org.id === lastId)
    : null
  const first = last ?? organizations.value[0]
  orgSlug.value = first?.slug?.trim() ? first.slug : null
}

async function refreshMeContext (options?: { force?: boolean }) {
  const routeSlug = slugFromRoute()
  applyOrgSlugFromSession(session.value?.user ?? null, routeSlug)

  // 未ログインでも 200 が返るセッション API で判定する
  const me = (await fetchSession(options)).user
  applyOrgSlugFromSession(me, routeSlug)

  if (orgSlug.value) {
    void warmOrgPageCaches(orgSlug.value)
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
    void loadNotifications()
  }
}

function formatDueDateLabel (value: string | null | undefined): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${match[1]}/${match[2]}/${match[3]}`
}

function taskNotificationSubject (item: AppNotification): string {
  const title = item.data?.title?.trim() || 'タスク'
  const workspaceName = item.data?.workspace_name?.trim() || ''
  const parentTitle = item.data?.parent_task_title?.trim() || ''
  const taskName = parentTitle ? `「（${parentTitle}）${title}」` : `「${title}」`
  if (workspaceName) {
    return `スペース「${workspaceName}」の${taskName}`
  }
  return taskName
}

function notificationLabel (item: AppNotification): string {
  const title = item.data?.title?.trim() || 'タスク'
  const taskSubject = taskNotificationSubject(item)
  const workspaceName = item.data?.workspace_name?.trim() || item.data?.title?.trim() || 'スペース'
  const organizationName = item.data?.organization_name?.trim() || item.data?.title?.trim() || '組織'
  if (item.type === 'task.assigned') {
    return `${taskSubject}に担当者として追加されました`
  }
  if (item.type === 'task.due_date_changed') {
    const due = formatDueDateLabel(item.data?.due_date)
    if (item.data?.due_date_change === 'cleared' || !due) {
      return `${taskSubject}の期限が削除されました`
    }
    if (item.data?.due_date_change === 'changed') {
      return `${taskSubject}の期限が ${due} に変更されました`
    }
    return `${taskSubject}の期限が ${due} に設定されました`
  }
  if (item.type === 'task.archived') {
    return `${taskSubject}がアーカイブされました`
  }
  if (item.type === 'task.restored') {
    return `${taskSubject}が復元されました`
  }
  if (item.type === 'task.deleted') {
    return `${taskSubject}が削除されました`
  }
  if (item.type === 'workspace.member_added') {
    return `「${workspaceName}」のメンバーに追加されました`
  }
  if (item.type === 'organization.role_changed') {
    const roleLabel = item.data?.role === 'admin' ? '管理者' : 'メンバー'
    return `「${organizationName}」での役割が${roleLabel}に変更されました`
  }
  if (item.type === 'organization.invited') {
    return `「${organizationName}」に招待されました`
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
  if (item.type === 'organization.invited') {
    const token = item.data?.invite_token
    if (token) {
      await router.push(`/invite/${token}`)
    }
    return
  }
  if (item.type === 'organization.role_changed') {
    if (slug) {
      await router.push(`/org/${slug}/workspaces`)
    }
    return
  }
  const workspaceId = item.data?.workspace_id
  if (!slug || !workspaceId) {
    return
  }
  const opensTask = item.type !== 'task.deleted' && item.type !== 'workspace.member_added'
  const query: Record<string, string> = {}
  if (opensTask && workspaceViewFromRoute(route) === 'wbs') {
    query.view = 'wbs'
  }
  const taskId = item.data?.task_id
  if (opensTask && typeof taskId === 'number' && Number.isFinite(taskId) && taskId > 0) {
    query.task = String(taskId)
  }
  await router.push({
    path: `/org/${slug}/workspaces/${workspaceId}`,
    query,
  })
}

function toggleMenu () {
  menuOpen.value = !menuOpen.value
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

watch([notifications, notificationsLoading], () => {
  if (!notificationsOpen.value || !import.meta.client) {
    return
  }
  nextTick(() => {
    syncNotificationsScrollbarGutter()
  })
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

function orgSettingsRoute (slug: string) {
  return { path: `/org/${slug}/settings`, query: { tab: 'organization' } }
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

async function goCreateOrganization () {
  closeMenu()
  await router.push('/organizations/new')
}

/** 同じ組織なら閉じるだけ。別組織はセッションを更新してそのトップへ進む */
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
    patchSessionUser({ last_organization_id: org.id })
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
  if (loggingOut.value) {
    return
  }
  loggingOut.value = true
  logoutError.value = null
  try {
    // 成功時は別画面へ移動する。失敗したときはログイン状態を残し、このメニューに留まる。
    await endSession()
  } catch (e: unknown) {
    loggingOut.value = false
    logoutError.value = e instanceof UnsavedDiscardError
      ? e.message
      : 'ログアウトに失敗しました。もう一度お試しください。'
    menuOpen.value = true
  }
}

function onOrgUpdated (e: Event) {
  const detail = (e as CustomEvent<{
    slug?: string
    name?: string
    icon_url?: string | null
  }>).detail
  const slug = detail?.slug
  const currentOrgs = session.value?.user?.organizations
  if (!slug || !currentOrgs) {
    void refreshMeContext({ force: true })
    return
  }
  patchSessionUser({
    organizations: currentOrgs.map((org) => {
      if (org.slug !== slug) return org
      return {
        ...org,
        ...(typeof detail.name === 'string' ? { name: detail.name } : {}),
        ...('icon_url' in detail ? { icon_url: detail.icon_url ?? null } : {}),
      }
    }),
  })
}

function onUserProfileUpdated (e: Event) {
  const detail = (e as CustomEvent<{ id?: number; name?: string; avatar_url?: string | null }>).detail
  const name = (detail?.name || '').trim()
  if (!detail) {
    void refreshMeContext({ force: true })
    return
  }
  const patch: { name?: string; avatar_url?: string | null } = {}
  if (name) {
    patch.name = name
  }
  if ('avatar_url' in detail) {
    patch.avatar_url = detail.avatar_url || null
  }
  if (Object.keys(patch).length === 0) {
    void refreshMeContext({ force: true })
    return
  }
  patchSessionUser(patch)
}

watch(
  () => route.fullPath,
  () => {
    void refreshMeContext({ force: true })
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

if (session.value?.user) {
  applyOrgSlugFromSession(session.value.user, slugFromRoute())
}

onMounted(() => {
  void refreshMeContext({ force: true })
  if (import.meta.client) {
    window.addEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
    window.addEventListener('tm:org-updated', onOrgUpdated as EventListener)
    void loadNotifications()
    notificationsPollTimer = setInterval(() => {
      void loadNotifications()
    }, 60_000)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('tm:user-profile-updated', onUserProfileUpdated as EventListener)
    window.removeEventListener('tm:org-updated', onOrgUpdated as EventListener)
    if (notificationsPollTimer) {
      clearInterval(notificationsPollTimer)
      notificationsPollTimer = null
    }
  }
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/app/AppGlobalHeader.scss"></style>
