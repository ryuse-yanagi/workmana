<template>
  <div class="auth-field">
    <label
      v-if="htmlFor"
      class="auth-label"
      :for="htmlFor"
    >{{ label }}</label>
    <span
      v-else
      class="auth-label"
    >{{ label }}</span>
    <slot />
    <p
      v-if="error"
      class="auth-field-error"
    >{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  error?: string | null
  htmlFor?: string
}>()
</script>
