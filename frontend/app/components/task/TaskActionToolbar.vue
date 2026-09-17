<template>
  <div
    class="action-toolbar"
    :class="[
      { 'action-toolbar--with-aside': Boolean($slots.aside) },
      toolbarClass,
    ]"
  >
    <div
      ref="actionButtonsRef"
      :class="buttonsClass"
    >
      <slot />
    </div>
    <div
      v-if="$slots.aside"
      class="action-toolbar__aside"
    >
      <slot name="aside" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** Wrapper class for the buttons container (e.g. `action-buttons` or `action-button-rows`). */
  buttonsClass?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
  toolbarClass?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
}>(), {
  buttonsClass: 'action-buttons',
  toolbarClass: undefined,
})

const actionButtonsRef = ref<HTMLElement | null>(null)

defineExpose({
  actionButtonsRef,
  el: actionButtonsRef,
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/TaskActionToolbar.scss"></style>
