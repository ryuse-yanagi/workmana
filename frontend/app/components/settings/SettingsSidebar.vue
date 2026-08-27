<template>
  <aside class="settings-sidebar">
    <div
      v-for="section in sections"
      :key="section.title"
      class="menu-section"
    >
      <p class="menu-section__title">{{ section.title }}</p>
      <button
        v-for="item in section.items"
        :key="item.key"
        type="button"
        class="menu-item"
        :class="{ 'menu-item--active': activeTab === item.key }"
        @click="emit('select', item.key)"
      >
        <span>{{ item.label }}</span>
        <span class="menu-arrow">›</span>
      </button>
    </div>
  </aside>
</template>
<script setup lang="ts">
import type { SettingsMenuSection, SettingsTabKey } from './types'
defineProps<{
  sections: SettingsMenuSection[]
  activeTab: SettingsTabKey
}>()
const emit = defineEmits<{
  select: [SettingsTabKey]
}>()
</script>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsSidebar.scss"></style>
