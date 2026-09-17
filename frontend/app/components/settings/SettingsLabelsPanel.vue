<template>
  <SettingsPanel title="ラベル設定">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        @click="openAddCategory"
      >
        <Group :size="20" :stroke-width="2.1" aria-hidden="true" />
        カテゴリ追加
      </button>
    </template>
    <SettingsLabelCategoryPanel
      v-show="labelTab === 'workspace'"
      ref="workspacePanelRef"
      :org-slug="orgSlug"
      label-kind="workspace"
      :can-manage="canManage"
    />
    <SettingsLabelCategoryPanel
      v-show="labelTab === 'task'"
      ref="taskPanelRef"
      :org-slug="orgSlug"
      label-kind="task"
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
  labelTab: SettingsLabelTabKey
  canManage: boolean
}>()
const workspacePanelRef = ref<{ openAddCategory: () => void } | null>(null)
const taskPanelRef = ref<{ openAddCategory: () => void } | null>(null)

function openAddCategory () {
  const panel = props.labelTab === 'workspace'
    ? workspacePanelRef.value
    : taskPanelRef.value
  panel?.openAddCategory()
}
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsLabelsPanel.global.scss"></style>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsLabelsPanel.scss"></style>
