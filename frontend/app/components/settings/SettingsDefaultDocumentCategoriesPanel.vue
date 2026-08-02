<template>
  <SettingsDefaultNamedColorItemsPanel
    :org-slug="orgSlug"
    :initial-items="initialItems"
    :can-manage="canManage"
    title="資料カテゴリ設定"
    settings-field="default_document_category_names"
    :default-items="DEFAULT_DOCUMENT_CATEGORY_ITEMS"
    item-kind="カテゴリ"
    add-button-label="カテゴリ追加"
    :add-button-icon="Group"
    create-modal-title="カテゴリの作成"
    edit-modal-title="カテゴリの編集"
    delete-modal-title="カテゴリの削除"
    save-success-message="資料カテゴリ設定を更新しました。"
    save-error-message="資料カテゴリ設定の更新に失敗しました"
  />
</template>
<script setup lang="ts">
import { Group } from 'lucide-vue-next'
import SettingsDefaultNamedColorItemsPanel from './SettingsDefaultNamedColorItemsPanel.vue'
import { DEFAULT_DOCUMENT_CATEGORY_ITEMS, type DefaultNamedColorItem } from './types'
defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
  canManage: boolean
}>()
</script>
