<template>
  <main class="settings-page">
    <template v-if="settingsFatalError">
      <PageLoadFatal :message="settingsFatalError" @retry="retrySettingsLoad" />
    </template>

    <template v-else-if="settingsPageReady && settingsSnapshot">
      <header class="settings-header">
        <h1>設定</h1>
        <p class="subtitle">左のメニューから変更したい設定を選択してください。</p>
      </header>

      <div class="settings-main">
        <section class="settings-layout">
          <SettingsSidebar
            :items="menuItems"
            :active-tab="activeTab"
            @select="selectTab"
          />

          <section class="settings-content">
            <SettingsWorkUnitLabelPanel
              v-show="activeTab === 'work_unit_label'"
              :org-slug="slug"
              :initial-label="workUnitLabelFromSnapshot"
            />
            <SettingsDefaultBoardListsPanel
              v-show="activeTab === 'default_board_lists'"
              :org-slug="slug"
              :initial-names="defaultBoardListNamesFromSnapshot"
            />
            <SettingsEffortPanel
              v-show="activeTab === 'effort_settings'"
              :org-slug="slug"
              :initial-unit="effortUnitFromSnapshot"
            />
            <SettingsLabelsPanel
              v-show="activeTab === 'labels'"
              :org-slug="slug"
              :initial-project-labels="settingsSnapshot.projectLabels"
              :initial-task-labels="settingsSnapshot.taskLabels"
              :initial-label-tab="initialLabelTab"
            />
          </section>
        </section>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../composables/useAppLoadingCursor'
import { useOrgSettingsPageData } from '../../../composables/useOrgSettingsPageData'
import SettingsDefaultBoardListsPanel from '../../../components/settings/SettingsDefaultBoardListsPanel.vue'
import SettingsEffortPanel from '../../../components/settings/SettingsEffortPanel.vue'
import SettingsLabelsPanel from '../../../components/settings/SettingsLabelsPanel.vue'
import SettingsSidebar from '../../../components/settings/SettingsSidebar.vue'
import SettingsWorkUnitLabelPanel from '../../../components/settings/SettingsWorkUnitLabelPanel.vue'
import {
  normalizeDefaultBoardListNames,
  type SettingsLabelTabKey,
  type SettingsPageSnapshot,
  type SettingsTabKey,
} from '../../../components/settings/types'
import { normalizeEffortUnit } from '../../../composables/useTaskFormHelpers'

definePageMeta({
  name: 'org-slug-settings',
  // タブ切替は query のみ変わるため path を key にする（fullPath だと KeepAlive がタブごとに別インスタンスになり activeTab がずれる）
  key: route => route.path,
  keepalive: true,
})

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const {
  fetchSnapshot,
  getCached,
  invalidateCached,
  DEFAULT_WORK_UNIT_LABEL,
} = useOrgSettingsPageData()

const menuItems: Array<{ key: SettingsTabKey; label: string }> = [
  { key: 'work_unit_label', label: 'work_unit_label設定' },
  { key: 'default_board_lists', label: 'リスト設定' },
  { key: 'effort_settings', label: '工数設定' },
  { key: 'labels', label: 'ラベル設定' },
]

const activeTab = ref<SettingsTabKey>('work_unit_label')
const initialLabelTab = ref<SettingsLabelTabKey>('project')
const settingsPageReady = ref(false)
const settingsFatalError = ref<string | null>(null)
const settingsSnapshot = ref<SettingsPageSnapshot | null>(null)

const workUnitLabelFromSnapshot = computed(() => {
  const raw = settingsSnapshot.value?.orgSettings.work_unit_label
  return (raw || '').trim() || DEFAULT_WORK_UNIT_LABEL
})

const defaultBoardListNamesFromSnapshot = computed(() => {
  return normalizeDefaultBoardListNames(settingsSnapshot.value?.orgSettings.default_board_list_names)
})

const effortUnitFromSnapshot = computed(() => {
  return normalizeEffortUnit(settingsSnapshot.value?.orgSettings.effort_unit)
})

async function loadInitialData (opts?: { refresh?: boolean }) {
  settingsFatalError.value = null
  const slugValue = slug.value

  if (!opts?.refresh) {
    const cached = getCached(slugValue)
    if (cached) {
      settingsSnapshot.value = cached
      settingsPageReady.value = true
      return
    }
  } else {
    settingsPageReady.value = false
    settingsSnapshot.value = null
  }

  const r = await withAppLoadingCursor(() => raceWithTimeout(
    () => fetchSnapshot(slugValue),
    TM_PAGE_LOAD_TIMEOUT_MS,
  ))

  if (!r.ok) {
    settingsFatalError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
    return
  }

  settingsSnapshot.value = r.value
  settingsPageReady.value = true
}

function retrySettingsLoad () {
  invalidateCached(slug.value)
  void loadInitialData({ refresh: true })
}

function applyTabFromRoute () {
  const raw = route.query.tab
  const tab = typeof raw === 'string' ? raw.trim() : ''
  if (tab === 'work_unit_label') {
    activeTab.value = 'work_unit_label'
    return
  }
  if (tab === 'default_board_lists') {
    activeTab.value = 'default_board_lists'
    return
  }
  if (tab === 'effort_settings') {
    activeTab.value = 'effort_settings'
    return
  }
  if (tab === 'task_labels') {
    activeTab.value = 'labels'
    initialLabelTab.value = 'task'
    return
  }
  if (tab === 'project_labels' || tab === 'labels') {
    activeTab.value = 'labels'
    const labelTab = route.query.labelTab
    initialLabelTab.value = labelTab === 'task' ? 'task' : 'project'
    return
  }
  activeTab.value = 'work_unit_label'
}

function selectTab (tab: SettingsTabKey) {
  activeTab.value = tab
  void router.replace({ path: route.path, query: { tab } })
}

onBeforeMount(() => {
  const cached = getCached(slug.value)
  if (cached) {
    settingsSnapshot.value = cached
    settingsPageReady.value = true
  }
})

onMounted(() => {
  applyTabFromRoute()
  if (!settingsPageReady.value) {
    void loadInitialData()
  }
})

onActivated(() => {
  applyTabFromRoute()
})

watch(
  () => route.query.tab,
  () => {
    applyTabFromRoute()
  },
)
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  padding: 1.25rem 1rem 2rem;
  font-family: system-ui, sans-serif;
}

.settings-header,
.settings-layout {
  max-width: 76rem;
  margin: 0 auto;
}

h1 {
  margin: 0.7rem 0 0.3rem;
  font-size: 1.7rem;
  color: #0f172a;
}

.subtitle {
  margin: 0 0 0.9rem;
  color: mixin.$text-sub;
}

.settings-layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  gap: 1rem;
  align-items: start;
}

.settings-content {
  min-height: 22rem;
}

@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
}
</style>
