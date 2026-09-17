<template>
  <div class="field">
    <span>{{ label }}</span>
    <slot />
    <p
      v-if="error"
      class="field-error"
    >{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  error?: string | null
}>()
</script>
