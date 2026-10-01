<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="modal-switch-backdrop"
      aria-hidden="true"
    />
  </Teleport>
</template>
<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps<{
  active: boolean
}>()

function syncKeepBackdropClass (active: boolean) {
  if (!import.meta.client) {
    return
  }
  document.documentElement.classList.toggle('wm-modal-keep-backdrop', active)
}

watch(() => props.active, syncKeepBackdropClass, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => {
  syncKeepBackdropClass(false)
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/shared/ModalSwitchBackdrop.scss"></style>
