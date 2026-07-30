<template>
  <SettingsDefaultNamedColorItemsPanel
    :org-slug="orgSlug"
    :initial-items="initialItems"
    :can-manage="canManage"
    title="ステータス設定"
    note="スペースに設定できるステータスの選択肢と色を定義します。上から順に表示されます。新規スペースには先頭のステータスが自動で設定されます。"
    settings-field="default_workspace_status_names"
    :default-items="DEFAULT_WORKSPACE_STATUS_ITEMS"
    item-kind="ステータス"
    add-button-label="ステータス追加"
    :add-button-icon="BadgePlus"
    create-modal-title="ステータスの作成"
    edit-modal-title="ステータスの編集"
    delete-modal-title="ステータスの削除"
    save-success-message="ステータス設定を更新しました。"
    save-error-message="ステータス設定の更新に失敗しました"
  />
</template>
<script setup lang="ts">
import { BadgePlus } from 'lucide-vue-next'
import SettingsDefaultNamedColorItemsPanel from './SettingsDefaultNamedColorItemsPanel.vue'
import { DEFAULT_WORKSPACE_STATUS_ITEMS, type DefaultNamedColorItem } from './types'
defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
  canManage: boolean
}>()
</script>
