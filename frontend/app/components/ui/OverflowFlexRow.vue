<template>
  <div ref="rootRef" class="overflow-flex-row">
    <div ref="trackRef" class="overflow-flex-row__track">
      <slot />
    </div>
    <span
      v-if="hiddenCount > 0"
      class="overflow-flex-row__more"
      :title="`他${hiddenCount}件`"
    >+{{ hiddenCount }}件</span>
    <span
      ref="moreProbeRef"
      class="overflow-flex-row__more overflow-flex-row__more--probe"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  watchKey?: string | number
}>()

const rootRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const moreProbeRef = ref<HTMLElement | null>(null)
const hiddenCount = ref(0)
let resizeObserver: ResizeObserver | null = null

function gapOf (el: HTMLElement) {
  const value = Number.parseFloat(getComputedStyle(el).gap || '0')
  return Number.isFinite(value) ? value : 0
}

function measureMoreWidth (count: number) {
  const probe = moreProbeRef.value
  if (!probe || count <= 0) {
    return 0
  }
  probe.textContent = `+${count}件`
  return probe.offsetWidth
}

function updateOverflow () {
  const root = rootRef.value
  const track = trackRef.value
  if (!root || !track) {
    hiddenCount.value = 0
    return
  }

  const items = Array.from(track.children) as HTMLElement[]
  for (const item of items) {
    item.style.removeProperty('display')
  }

  if (!items.length) {
    hiddenCount.value = 0
    return
  }

  const available = root.clientWidth
  const gap = gapOf(track)
  const widths = items.map(item => item.offsetWidth)

  let fitCount = 0
  for (let visible = items.length; visible >= 0; visible -= 1) {
    const hidden = items.length - visible
    let used = 0
    for (let i = 0; i < visible; i += 1) {
      used += widths[i]! + (i > 0 ? gap : 0)
    }
    if (hidden > 0) {
      used += (visible > 0 ? gap : 0) + measureMoreWidth(hidden)
    }
    if (used <= available + 0.5) {
      fitCount = visible
      break
    }
  }

  const nextHidden = items.length - fitCount
  hiddenCount.value = nextHidden
  for (let i = 0; i < items.length; i += 1) {
    items[i]!.style.display = i < fitCount ? '' : 'none'
  }
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 3.5px;
  min-width: 0;
  max-width: 100%;
}
.overflow-flex-row__track {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 3.5px;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
}
.overflow-flex-row__track > :deep(*) {
  flex-shrink: 0;
}
.overflow-flex-row__more {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 2.52px 7.7px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
  font-weight: 700;
  font-size: 10.92px;
  line-height: 1.2;
  white-space: nowrap;
}
.overflow-flex-row__more--probe {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
}
</style>
