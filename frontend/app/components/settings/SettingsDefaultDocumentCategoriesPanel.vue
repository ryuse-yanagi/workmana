<template>
  <SettingsDefaultNamedColorItemsPanel
    :org-slug="orgSlug"
    :initial-items="initialItems"
    :can-manage="canManage"
    title="カテゴリ設定"
    settings-field="default_document_category_names"
    :default-items="DEFAULT_DOCUMENT_CATEGORY_ITEMS"
    item-kind="カテゴリ"
    add-button-label="カテゴリ追加"
    :add-button-icon="Group"
    :add-modal-title="settingsScopedModalTitle('資料', 'カテゴリ', '追加')"
    :edit-modal-title="settingsScopedModalTitle('資料', 'カテゴリ', '編集')"
    :delete-modal-title="settingsScopedModalTitle('資料', 'カテゴリ', '削除')"
    save-error-message="カテゴリ設定の更新に失敗しました"
  />
</template>
<script setup lang="ts">
import { Group } from 'lucide-vue-next'
import SettingsDefaultNamedColorItemsPanel from './SettingsDefaultNamedColorItemsPanel.vue'
import { DEFAULT_DOCUMENT_CATEGORY_ITEMS, settingsScopedModalTitle, type DefaultNamedColorItem } from './types'
defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
  canManage: boolean
}>()
</script>
