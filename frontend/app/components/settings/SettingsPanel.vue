<template>
  <article class="settings-panel">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">{{ title }}</h2>
      <div v-if="$slots.actions" class="settings-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </article>
</template>
<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsPanel.scss"></style>
