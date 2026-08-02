<template>
  <SettingsPanel title="ラベル設定">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        @click="openCreateCategory"
      >
        <Group :size="20" :stroke-width="2.1" aria-hidden="true" />
        カテゴリ追加
      </button>
    </template>
    <div class="settings-label-tabs" role="tablist" aria-label="ラベル種別">
      <button
        v-for="item in labelTabs"
        :key="item.key"
        type="button"
        role="tab"
        class="settings-label-tabs__btn"
        :class="{ 'settings-label-tabs__btn--active': activeLabelTab === item.key }"
        :aria-selected="activeLabelTab === item.key"
        @click="activeLabelTab = item.key"
      >
        {{ item.label }}
      </button>
    </div>
    <SettingsLabelCategoryPanel
      v-show="activeLabelTab === 'workspace'"
      ref="workspacePanelRef"
      :org-slug="orgSlug"
      label-kind="workspace"
      :can-manage="canManage"
    />
    <SettingsLabelCategoryPanel
      v-show="activeLabelTab === 'task'"
      ref="taskPanelRef"
      :org-slug="orgSlug"
      label-kind="task"
      :can-manage="canManage"
    />
    <SettingsLabelCategoryPanel
      v-show="activeLabelTab === 'document'"
      ref="documentPanelRef"
      :org-slug="orgSlug"
      label-kind="document"
      :can-manage="canManage"
    />
  </SettingsPanel>
</template>
<script setup lang="ts">
import { Group } from 'lucide-vue-next'
import SettingsPanel from './SettingsPanel.vue'
import SettingsLabelCategoryPanel from './SettingsLabelCategoryPanel.vue'
import type { SettingsLabelTabKey } from './types'
const props = defineProps<{
  orgSlug: string
  initialLabelTab?: SettingsLabelTabKey
  canManage: boolean
}>()
const labelTabs: Array<{ key: SettingsLabelTabKey; label: string }> = [
  { key: 'workspace', label: 'スペース' },
  { key: 'task', label: 'タスク' },
  { key: 'document', label: '資料' },
]
const activeLabelTab = ref<SettingsLabelTabKey>(props.initialLabelTab ?? 'workspace')
const workspacePanelRef = ref<{ openCreateCategory: () => void } | null>(null)
const taskPanelRef = ref<{ openCreateCategory: () => void } | null>(null)
const documentPanelRef = ref<{ openCreateCategory: () => void } | null>(null)

function openCreateCategory () {
  const panel = activeLabelTab.value === 'workspace'
    ? workspacePanelRef.value
    : activeLabelTab.value === 'task'
      ? taskPanelRef.value
      : documentPanelRef.value
  panel?.openCreateCategory()
}

watch(
  () => props.initialLabelTab,
  (tab) => {
    if (tab) {
      activeLabelTab.value = tab
    }
  },
)
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsLabelsPanel.global.scss"></style>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsLabelsPanel.scss"></style>
