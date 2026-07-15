<template>
  <SettingsDefaultNamedColorItemsPanel
    :org-slug="orgSlug"
    :initial-items="initialItems"
    title="資料カテゴリ設定"
    note="資料に設定できるカテゴリの選択肢と色を定義します。上から順に表示されます。各資料は1つのカテゴリのみ選択できます。"
    settings-field="default_document_category_names"
    :default-items="DEFAULT_DOCUMENT_CATEGORY_ITEMS"
    item-kind="カテゴリ"
    add-button-label="カテゴリ追加"
    :add-button-icon="ListTree"
    create-modal-title="カテゴリの作成"
    edit-modal-title="カテゴリの編集"
    delete-modal-title="カテゴリの削除"
    save-success-message="資料カテゴリ設定を更新しました。"
    save-error-message="資料カテゴリ設定の更新に失敗しました"
  />
</template>
<script setup lang="ts">
import { ListTree } from 'lucide-vue-next'
import SettingsDefaultNamedColorItemsPanel from './SettingsDefaultNamedColorItemsPanel.vue'
import { DEFAULT_DOCUMENT_CATEGORY_ITEMS, type DefaultNamedColorItem } from './types'
defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
}>()
</script>
