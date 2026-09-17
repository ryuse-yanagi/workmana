<template>
  <p :class="rootClass">{{ message }}</p>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  message: string
  className?: string
}>(), {
  className: undefined,
})

const rootClass = computed(() => props.className || undefined)
</script>
