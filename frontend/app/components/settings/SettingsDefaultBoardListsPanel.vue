<template>
  <SettingsDefaultNamedColorItemsPanel
    :org-slug="orgSlug"
    :initial-items="initialItems"
    :can-manage="canManage"
    title="リスト設定"
    note="スペース新規追加時に自動で作成するリストの名前と色を設定します。上から順に左側の列として並びます。"
    settings-field="default_board_list_names"
    :default-items="DEFAULT_BOARD_LIST_ITEMS"
    item-kind="リスト"
    add-button-label="リスト追加"
    :add-button-icon="ListPlus"
    create-modal-title="リストの作成"
    edit-modal-title="リストの編集"
    delete-modal-title="リストの削除"
    save-success-message="リスト設定を更新しました。"
    save-error-message="リスト設定の更新に失敗しました"
  />
</template>
<script setup lang="ts">
import { ListPlus } from 'lucide-vue-next'
import SettingsDefaultNamedColorItemsPanel from './SettingsDefaultNamedColorItemsPanel.vue'
import { DEFAULT_BOARD_LIST_ITEMS, type DefaultNamedColorItem } from './types'
defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
  canManage: boolean
}>()
</script>
