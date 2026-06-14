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

<style lang="scss" scoped>
.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.menu-item {
  border: 1px solid #dbe3ee;
  background: #fff;
  border-radius: 9px;
  padding: 0.8rem 0.9rem;
  text-align: left;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f2945;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.menu-item--active {
  border-color: mixin.$main;
  box-shadow: 0 0 0 2px color-mix(in srgb, mixin.$main 15%, transparent);
}

.menu-arrow {
  color: #94a3b8;
  font-size: 1.1rem;
}

@media (max-width: 900px) {
  .settings-sidebar {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
