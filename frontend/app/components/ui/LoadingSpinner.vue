<template>
  <div
    class="spinner"
    :role="busyLabel ? 'status' : undefined"
    :aria-busy="busyLabel ? true : undefined"
    :aria-label="busyLabel"
  />
</template>

<script setup lang="ts">
defineProps<{
  busyLabel?: string
}>()
</script>
