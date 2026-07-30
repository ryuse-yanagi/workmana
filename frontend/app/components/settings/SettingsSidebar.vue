<template>
  <aside class="settings-sidebar">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="menu-item"
      :class="{ 'menu-item--active': activeTab === item.key }"
      @click="emit('select', item.key)"
    >
      <span>{{ item.label }}</span>
      <span class="menu-arrow">›</span>
    </button>
  </aside>
</template>
<script setup lang="ts">
import type { SettingsTabKey } from './types'
defineProps<{
  items: Array<{ key: SettingsTabKey; label: string }>
  activeTab: SettingsTabKey
}>()
const emit = defineEmits<{
  select: [SettingsTabKey]
}>()
</script>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsSidebar.scss"></style>
