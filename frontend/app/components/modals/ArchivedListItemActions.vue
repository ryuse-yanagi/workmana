<template>
  <footer
    v-if="show"
    :class="`${prefix}__actions`"
  >
    <button
      v-if="showRestore"
      type="button"
      :class="`${prefix}__action`"
      :disabled="disabled"
      @click="$emit('restore')"
    >
      復元
    </button>
    <button
      v-if="showDelete"
      type="button"
      :class="[`${prefix}__action`, `${prefix}__action--danger`]"
      :disabled="disabled"
      @click="$emit('delete')"
    >
      削除
    </button>
    <slot />
  </footer>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  prefix: string
  show?: boolean
  showRestore?: boolean
  showDelete?: boolean
  disabled?: boolean
}>(), {
  show: true,
  showRestore: true,
  showDelete: true,
  disabled: false,
})

defineEmits<{
  restore: []
  delete: []
}>()
</script>
