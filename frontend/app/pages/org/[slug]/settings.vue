<template>
  <main class="settings-page">
    <template v-if="settingsFatalError">
      <PageLoadFatal :message="settingsFatalError" @retry="retrySettingsLoad" />
    </template>

    <template v-else>
      <header class="settings-header">
        <h1>設定</h1>
        <p class="subtitle">左のメニューから変更したい設定を選択してください。</p>
      </header>

      <div v-if="!settingsPageReady" class="page-await-spacer" aria-busy="true" />

      <Transition v-else name="tm-fade" appear>
        <div key="settings-body" class="settings-main page-shell-fade">
          <section class="settings-layout">
            <SettingsSidebar
              :items="menuItems"
              :active-tab="activeTab"
              @select="selectTab"
            />

            <section class="settings-content">
              <SettingsWorkUnitLabelPanel
                v-if="activeTab === 'work_unit_label'"
                :org-slug="slug"
              />
              <SettingsDefaultBoardListsPanel
                v-else-if="activeTab === 'default_board_lists'"
                :org-slug="slug"
              />
              <SettingsProjectLabelsPanel
                v-else-if="activeTab === 'project_labels'"
                :org-slug="slug"
              />
              <SettingsTaskLabelsPanel v-else :org-slug="slug" />
            </section>
          </section>
        </div>
      </Transition>
    </template>
  </main>
</template>

<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../composables/raceWithTimeout'
import { useApi } from '../../../composables/useApi'
import SettingsDefaultBoardListsPanel from '../../../components/settings/SettingsDefaultBoardListsPanel.vue'
import SettingsProjectLabelsPanel from '../../../components/settings/SettingsProjectLabelsPanel.vue'
import SettingsSidebar from '../../../components/settings/SettingsSidebar.vue'
import SettingsTaskLabelsPanel from '../../../components/settings/SettingsTaskLabelsPanel.vue'
import SettingsWorkUnitLabelPanel from '../../../components/settings/SettingsWorkUnitLabelPanel.vue'
import type { SettingsTabKey } from '../../../components/settings/types'

definePageMeta({ name: 'org-slug-settings' })

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const { api } = useApi()

const menuItems: Array<{ key: SettingsTabKey; label: string }> = [
  { key: 'work_unit_label', label: 'work_unit_label設定' },
  { key: 'default_board_lists', label: 'デフォルトリスト設定' },
  { key: 'project_labels', label: 'プロジェクトラベル設定' },
  { key: 'task_labels', label: 'タスクラベル設定' },
]

const activeTab = ref<SettingsTabKey>('work_unit_label')
const settingsPageReady = ref(false)
const settingsFatalError = ref<string | null>(null)

async function loadInitialData () {
  settingsFatalError.value = null

  const r = await raceWithTimeout(async () => {
    await api('/me')
  }, TM_PAGE_LOAD_TIMEOUT_MS)

  if (!r.ok) {
    settingsFatalError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
    return
  }
  settingsPageReady.value = true
}

function retrySettingsLoad () {
  settingsFatalError.value = null
  void loadInitialData()
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
  if (tab === 'project_labels') {
    activeTab.value = 'project_labels'
    return
  }
  if (tab === 'task_labels') {
    activeTab.value = 'task_labels'
    return
  }
  activeTab.value = 'work_unit_label'
}

function selectTab (tab: SettingsTabKey) {
  activeTab.value = tab
  void router.replace({ path: route.path, query: { tab } })
}

onMounted(() => {
  applyTabFromRoute()
  void loadInitialData()
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
