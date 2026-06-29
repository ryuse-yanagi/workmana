<template>
  <SettingsPanel title="ラベル設定" note="ワークスペースやタスクで使うラベルをカテゴリごとに管理します。">
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
      :org-slug="orgSlug"
      label-kind="workspace"
    />
    <SettingsLabelCategoryPanel
      v-show="activeLabelTab === 'task'"
      :org-slug="orgSlug"
      label-kind="task"
    />
  </SettingsPanel>
</template>
<script setup lang="ts">
import SettingsPanel from './SettingsPanel.vue'
import SettingsLabelCategoryPanel from './SettingsLabelCategoryPanel.vue'
import type { SettingsLabelTabKey } from './types'
const props = defineProps<{
  orgSlug: string
  initialLabelTab?: SettingsLabelTabKey
}>()
const labelTabs: Array<{ key: SettingsLabelTabKey; label: string }> = [
  { key: 'workspace', label: 'ワークスペース' },
  { key: 'task', label: 'タスク' },
]
const activeLabelTab = ref<SettingsLabelTabKey>(props.initialLabelTab ?? 'workspace')
watch(
  () => props.initialLabelTab,
  (tab) => {
    if (tab) {
      activeLabelTab.value = tab
    }
  },
)
</script>
<style lang="scss">
@use './shared';
</style>
<style lang="scss" scoped>
.settings-label-tabs {
  display: inline-flex;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  padding: 0.2rem;
  border: 1px solid #dbe3ee;
  border-radius: 9px;
  background: #f8fafc;
}
.settings-label-tabs__btn {
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 0.42rem 0.85rem;
  font-size: 0.86rem;
  font-weight: 700;
  color: #475569;
  background: transparent;
  cursor: pointer;
}
.settings-label-tabs__btn--active {
  border-color: mixin.$main;
  background: #fff;
  color: #0f2945;
  box-shadow: 0 0 0 1px color-mix(in srgb, mixin.$main 12%, transparent);
}
</style>
