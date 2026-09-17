<template>
  <div class="auth-success">
    <p
      v-if="message"
      class="auth-copy"
    >{{ message }}</p>
    <slot name="message" />
    <slot>
      <button
        v-if="buttonLabel"
        type="button"
        class="auth-btn auth-btn--block"
        @click="emit('action')"
      >
        {{ buttonLabel }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  buttonLabel?: string
}>(), {
  message: undefined,
  buttonLabel: undefined,
})

const emit = defineEmits<{
  action: []
}>()
</script>
