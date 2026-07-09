<template>
  <div ref="rootRef" class="overflow-flex-row">
    <div ref="trackRef" class="overflow-flex-row__track">
      <slot />
    </div>
    <span
      v-if="hasOverflow"
      class="overflow-flex-row__more"
      aria-hidden="true"
    >...</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  watchKey?: string | number
}>()

const rootRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const hasOverflow = ref(false)
let resizeObserver: ResizeObserver | null = null

function updateOverflow () {
  const track = trackRef.value
  if (!track) {
    hasOverflow.value = false
    return
  }
  hasOverflow.value = track.scrollWidth > track.clientWidth + 1
}

onMounted(() => {
  if (!import.meta.client) {
    return
  }
  nextTick(() => {
    updateOverflow()
    const root = rootRef.value
    if (!root || !('ResizeObserver' in window)) {
      return
    }
    resizeObserver = new ResizeObserver(() => {
      updateOverflow()
    })
    resizeObserver.observe(root)
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => props.watchKey,
  () => {
    nextTick(() => updateOverflow())
  },
)
</script>

<style lang="scss" scoped>
.overflow-flex-row {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.overflow-flex-row__track {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 3.5px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
.overflow-flex-row__track > :deep(*) {
  flex-shrink: 0;
}
.overflow-flex-row__more {
  flex-shrink: 0;
  color: #64748b;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  padding-left: 2.8px;
}
</style>
