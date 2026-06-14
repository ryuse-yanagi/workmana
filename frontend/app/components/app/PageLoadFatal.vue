<template>
  <section class="load-fatal-panel">
    <p class="load-fatal-message">{{ message }}</p>
    <button type="button" class="load-fatal-retry" @click="$emit('retry')">
      {{ retryLabel }}
    </button>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  message: string
  retryLabel?: string
}>(), {
  retryLabel: '再試行',
})

defineEmits<{
  retry: []
}>()
</script>
