<template>
  <SettingsDefaultNamedColorItemsPanel
    :org-slug="orgSlug"
    :initial-items="initialItems"
    :can-manage="canManage"
    title="リスト初期設定"
    settings-field="default_board_list_names"
    :default-items="DEFAULT_BOARD_LIST_ITEMS"
    item-kind="リスト"
    add-button-label="リスト追加"
    :add-button-icon="ListPlus"
    :add-modal-title="settingsScopedModalTitle('スペース', 'リスト', '追加')"
    :edit-modal-title="settingsScopedModalTitle('スペース', 'リスト', '編集')"
    :delete-modal-title="settingsScopedModalTitle('スペース', 'リスト', '削除')"
    save-error-message="リスト設定の更新に失敗しました"
    :min-items="1"
  />
</template>
<script setup lang="ts">
import { ListPlus } from 'lucide-vue-next'
import SettingsDefaultNamedColorItemsPanel from './SettingsDefaultNamedColorItemsPanel.vue'
import { DEFAULT_BOARD_LIST_ITEMS, settingsScopedModalTitle, type DefaultNamedColorItem } from './types'
defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
  canManage: boolean
}>()
</script>
