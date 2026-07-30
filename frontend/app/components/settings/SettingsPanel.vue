<template>
  <article class="settings-panel">
    <h2 class="settings-panel__title">{{ title }}</h2>
    <p v-if="note" class="settings-panel__note">{{ note }}</p>
    <slot />
  </article>
</template>
<script setup lang="ts">
defineProps<{
  title: string
  note?: string
}>()
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsPanel.scss"></style>
