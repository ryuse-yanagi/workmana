<template>
  <main ref="settingsPageRef" class="settings-page">
    <template v-if="settingsFatalError">
      <PageLoadFatal :message="settingsFatalError" @retry="retrySettingsLoad" />
    </template>

    <template v-else>
      <div class="settings-main">
        <section class="settings-layout">
          <SettingsSidebar
            :sections="menuSections"
            :active-tab="activeTab"
            @select="selectTab"
          />

          <section class="settings-content">
            <div class="settings-content__scroller">
              <div
                v-if="!settingsPageReady || !settingsSnapshot"
                class="settings-content-loading"
                aria-busy="true"
                aria-label="読み込み中"
              >
                <div class="spinner" />
              </div>
              <div
                v-else
                :class="['settings-content-body', { 'settings-content-body--fade-in': contentShouldFadeIn }]"
              >
                <SettingsOrganizationPanel
                  v-show="activeTab === 'organization'"
                  :org-slug="slug"
                  :initial-name="settingsSnapshot.orgSettings.name"
                  :initial-icon-url="settingsSnapshot.orgSettings.icon_url"
                  :created-at="settingsSnapshot.orgSettings.created_at"
                  :member-count="settingsSnapshot.memberCount ?? settingsSnapshot.members?.length"
                  :can-manage="canManageSettings"
                />
                <SettingsMembersPanel
                  v-show="activeTab === 'members'"
                  :org-slug="slug"
                  :active="activeTab === 'members'"
                  :can-manage="canManageSettings"
                  :initial-members="settingsSnapshot.members ?? []"
                  :initial-invites="settingsSnapshot.pendingInvites ?? []"
                />
                <SettingsLabelsPanel
                  v-show="activeLabelTab !== null"
                  :org-slug="slug"
                  :label-tab="activeLabelTab ?? 'workspace'"
                  :can-manage="canManageSettings"
                />
                <SettingsDefaultWorkspaceStatusesPanel
                  v-show="activeTab === 'workspace_statuses'"
                  :org-slug="slug"
                  :initial-items="defaultWorkspaceStatusItemsFromSnapshot"
                  :can-manage="canManageSettings"
                />
                <SettingsDefaultBoardListsPanel
                  v-show="activeTab === 'default_board_lists'"
                  :org-slug="slug"
                  :initial-items="defaultBoardListItemsFromSnapshot"
                  :can-manage="canManageSettings"
                />
                <SettingsDefaultDocumentCategoriesPanel
                  v-show="activeTab === 'document_categories'"
                  :org-slug="slug"
                  :initial-items="defaultDocumentCategoryItemsFromSnapshot"
                  :can-manage="canManageSettings"
                />
              </div>
            </div>
          </section>
        </section>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../composables/shared/raceWithTimeout'
import { withAppLoadingCursor } from '../../../composables/ui/useAppLoadingCursor'
import { useCurrentUser } from '../../../composables/auth/useCurrentUser'
import { useOrgSettingsPageData } from '../../../composables/settings/useOrgSettingsPageData'
import SettingsDefaultBoardListsPanel from '../../../components/settings/SettingsDefaultBoardListsPanel.vue'
import SettingsDefaultWorkspaceStatusesPanel from '../../../components/settings/SettingsDefaultWorkspaceStatusesPanel.vue'
import SettingsDefaultDocumentCategoriesPanel from '../../../components/settings/SettingsDefaultDocumentCategoriesPanel.vue'
import SettingsLabelsPanel from '../../../components/settings/SettingsLabelsPanel.vue'
import SettingsMembersPanel from '../../../components/settings/SettingsMembersPanel.vue'
import SettingsOrganizationPanel from '../../../components/settings/SettingsOrganizationPanel.vue'
import SettingsSidebar from '../../../components/settings/SettingsSidebar.vue'
import {
  normalizeDefaultBoardListItems,
  normalizeDefaultDocumentCategoryItems,
  normalizeDefaultWorkspaceStatusItems,
  SETTINGS_LABEL_TAB_BY_KEY,
  type SettingsLabelTabKey,
  type SettingsMenuSection,
  type SettingsPageSnapshot,
  type SettingsTabKey,
} from '../../../components/settings/types'
import { useWorkspaceViewPageRoot } from '../../../composables/workspace/useWorkspaceViewPageRoot'
import { useOrgRole } from '../../../composables/org/useOrgRole'
import { useOrgSafeRedirect } from '../../../composables/org/useOrgSafeRedirect'
import { isAccessDeniedMessage } from '../../../utils/shared/resourceAccessError'

definePageMeta({
  name: 'org-slug-settings',
  key: route => route.path,
  keepalive: true,
})

useWorkspaceViewPageRoot()
const { redirectToMemberHome } = useOrgSafeRedirect()

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const { orgRole } = useOrgRole(slug)
const settingsPageRef = ref<HTMLElement | null>(null)
const {
  fetchSnapshot,
  getCached,
  invalidateCached,
} = useOrgSettingsPageData()
const { ensureCurrentUser } = useCurrentUser()

const menuSections: SettingsMenuSection[] = [
  {
    title: '共通',
    items: [
      { key: 'organization', label: '組織設定' },
      { key: 'members', label: 'ユーザー設定' },
    ],
  },
  {
    title: 'スペース',
    items: [
      { key: 'workspace_labels', label: 'ラベル設定' },
      { key: 'workspace_statuses', label: 'ステータス設定' },
      { key: 'default_board_lists', label: 'リスト初期設定' },
    ],
  },
  {
    title: 'タスク',
    items: [
      { key: 'task_labels', label: 'ラベル設定' },
    ],
  },
  {
    title: '資料',
    items: [
      { key: 'document_categories', label: 'カテゴリ設定' },
    ],
  },
]

const activeTab = ref<SettingsTabKey>('organization')
const settingsPageReady = ref(false)
const settingsFatalError = ref<string | null>(null)
const settingsSnapshot = ref<SettingsPageSnapshot | null>(null)
const loadedForUserId = ref<number | null>(null)
const contentShouldFadeIn = ref(false)
let settingsContentInitialRevealDone = false

const activeLabelTab = computed<SettingsLabelTabKey | null>(() => {
  return SETTINGS_LABEL_TAB_BY_KEY[activeTab.value] ?? null
})

const defaultBoardListItemsFromSnapshot = computed(() => {
  return normalizeDefaultBoardListItems(settingsSnapshot.value?.orgSettings.default_board_list_names)
})

const defaultWorkspaceStatusItemsFromSnapshot = computed(() => {
  return normalizeDefaultWorkspaceStatusItems(settingsSnapshot.value?.orgSettings.default_workspace_status_names)
})

const defaultDocumentCategoryItemsFromSnapshot = computed(() => {
  return normalizeDefaultDocumentCategoryItems(settingsSnapshot.value?.orgSettings.default_document_category_names)
})

const canManageSettings = computed(() => {
  // セッションの admin / member を優先し、未取得のあいだだけ設定データのロールで表示する。
  if (orgRole.value === 'admin' || orgRole.value === 'member') {
    return orgRole.value === 'admin'
  }
  return settingsSnapshot.value?.orgSettings.role === 'admin'
})

/** ロール付きキャッシュがあれば再取得せず出し、権限が無ければ所属組織のスペース一覧へ戻す */
async function loadInitialData (opts?: { refresh?: boolean }) {
  settingsFatalError.value = null
  const slugValue = slug.value

  if (!opts?.refresh) {
    const cached = getCached(slugValue)
    if (cached?.orgSettings?.role) {
      settingsSnapshot.value = cached
      settingsPageReady.value = true
      return
    }
  } else {
    resetSettingsContentReveal()
    settingsPageReady.value = false
    settingsSnapshot.value = null
  }

  const r = await withAppLoadingCursor(() => raceWithTimeout(
    () => fetchSnapshot(slugValue, opts?.refresh ? { refresh: true } : undefined),
    TM_PAGE_LOAD_TIMEOUT_MS,
  ))

  if (!r.ok) {
    if (r.reason !== 'timeout' && isAccessDeniedMessage(r.message)) {
      await redirectToMemberHome()
      return
    }
    settingsFatalError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
    return
  }

  settingsSnapshot.value = r.value
  settingsPageReady.value = true
}

/** 同じユーザーの設定が既にあれば取り直さない */
async function syncForCurrentUser () {
  const userId = await ensureCurrentUser()
  if (
    userId !== null
    && loadedForUserId.value === userId
    && settingsSnapshot.value?.orgSettings?.role
  ) {
    return
  }

  await loadInitialData({ refresh: loadedForUserId.value !== null })
  loadedForUserId.value = userId
}

function revealLoadedSettingsContent () {
  if (settingsContentInitialRevealDone) {
    return
  }
  settingsContentInitialRevealDone = true
  contentShouldFadeIn.value = true
  setTimeout(() => {
    contentShouldFadeIn.value = false
  }, 260)
}

function resetSettingsContentReveal () {
  settingsContentInitialRevealDone = false
  contentShouldFadeIn.value = false
}

function retrySettingsLoad () {
  invalidateCached(slug.value)
  loadedForUserId.value = null
  resetSettingsContentReveal()
  settingsPageReady.value = false
  settingsSnapshot.value = null
  void syncForCurrentUser()
}

function applyTabFromRoute () {
  const raw = route.query.tab
  const tab = typeof raw === 'string' ? raw.trim() : ''
  if (tab === 'organization') {
    activeTab.value = 'organization'
    return
  }
  if (tab === 'members' || tab === 'invites') {
    activeTab.value = 'members'
    return
  }
  if (tab === 'workspace_statuses') {
    activeTab.value = 'workspace_statuses'
    return
  }
  if (tab === 'default_board_lists') {
    activeTab.value = 'default_board_lists'
    return
  }
  if (tab === 'document_categories') {
    activeTab.value = 'document_categories'
    return
  }
  if (tab === 'task_labels') {
    activeTab.value = 'task_labels'
    return
  }
  if (tab === 'workspace_labels' || tab === 'project_labels' || tab === 'labels') {
    activeTab.value = 'workspace_labels'
    const labelTab = route.query.labelTab
    if (labelTab === 'task') {
      activeTab.value = 'task_labels'
    }
    return
  }
  activeTab.value = 'organization'
}

function selectTab (tab: SettingsTabKey) {
  activeTab.value = tab
  void router.replace({ path: route.path, query: { tab } })
}

function resetSettingsPageScroll () {
  const page = settingsPageRef.value
  if (!page) {
    return
  }
  page.scrollTop = 0
}

function refreshSnapshotFromCache () {
  const cached = getCached(slug.value)
  if (!cached) {
    return
  }
  const current = settingsSnapshot.value
  const currentRole = current?.orgSettings.role
  if (!cached.orgSettings?.role && currentRole && current) {
    settingsSnapshot.value = {
      ...cached,
      orgSettings: {
        ...current.orgSettings,
        ...cached.orgSettings,
        role: currentRole,
      },
    }
    return
  }
  settingsSnapshot.value = cached
}

onBeforeMount(() => {
  const cached = getCached(slug.value)
  if (cached?.orgSettings?.role) {
    settingsSnapshot.value = cached
    settingsPageReady.value = true
  }
})

onMounted(() => {
  applyTabFromRoute()
  void syncForCurrentUser()
  if (import.meta.client) {
    window.addEventListener('tm:settings-members-updated', refreshSnapshotFromCache)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('tm:settings-members-updated', refreshSnapshotFromCache)
  }
})

onActivated(() => {
  applyTabFromRoute()
  void syncForCurrentUser()
})

watch(settingsPageReady, async (ready) => {
  if (!ready) {
    return
  }
  await nextTick()
  revealLoadedSettingsContent()
}, { immediate: true })

watch(activeTab, async () => {
  await nextTick()
  resetSettingsPageScroll()
})

watch(
  () => route.query.tab,
  () => {
    applyTabFromRoute()
  },
)
</script>

<style lang="scss" scoped src="~/assets/styles/pages/org/slug/settings.scss"></style>
