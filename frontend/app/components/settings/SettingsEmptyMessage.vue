<template>
  <p :class="rootClass">{{ resolvedMessage }}</p>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Full message override (used as-is when provided). */
  message?: string
  entityLabel?: string
  addButtonLabel?: string
  canManage?: boolean
  className?: string
}>(), {
  message: undefined,
  entityLabel: '',
  addButtonLabel: '追加',
  canManage: true,
  className: undefined,
})

const resolvedMessage = computed(() => {
  if (props.message) return props.message
  if (!props.entityLabel) return ''
  if (props.canManage) {
    return `まだ${props.entityLabel}がありません。「${props.addButtonLabel}」から追加してください。`
  }
  return `まだ${props.entityLabel}がありません。`
})

const rootClass = computed(() => props.className || undefined)
</script>
