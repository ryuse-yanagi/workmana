<template>
  <SettingsPanel title="ラベル設定" note="スペース、タスク、資料で使うラベルをカテゴリごとに管理します。">
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
    <SettingsLabelCategoryPanel
      v-show="activeLabelTab === 'document'"
      :org-slug="orgSlug"
      label-kind="document"
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
  { key: 'workspace', label: 'スペース' },
  { key: 'task', label: 'タスク' },
  { key: 'document', label: '資料' },
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
  gap: 4.9px;
  margin-bottom: 11.9px;
  padding: 2.8px;
  border: 1px solid #dbe3ee;
  border-radius: 9px;
  background: #f8fafc;
}
.settings-label-tabs__btn {
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 5.88px 11.9px;
  font-size: 12.04px;
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
