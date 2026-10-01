<template>
  <div
    ref="rootRef"
    class="sidebar-description"
    :class="{ 'sidebar-description--placeholder': isPlaceholder }"
  >
    <div
      class="sidebar-description__measure-host"
      aria-hidden="true"
    >
      <p
        ref="measureRef"
        class="sidebar-description__measure"
      />
    </div>
    <button
      v-if="collapsed"
      ref="expandRef"
      type="button"
      class="sidebar-description__surface sidebar-description__expand"
      :aria-expanded="false"
      :aria-label="label"
      @click="expandDescription"
    >
      <span class="sidebar-description__text sidebar-description__text--clamp">{{ previewText }}</span>
      <span
        class="sidebar-description__mark"
        aria-hidden="true"
      />
    </button>
    <div
      v-else
      class="sidebar-description__surface"
    >
      <p
        class="sidebar-description__text"
        :class="{ 'sidebar-description__text--with-mark': showCollapse }"
        :aria-label="isPlaceholder ? `${label}なし` : label"
      >{{ displayText }}</p>
      <button
        v-if="showCollapse"
        ref="collapseRef"
        type="button"
        class="sidebar-description__collapse"
        :aria-expanded="true"
        :aria-label="`${label}を閉じる`"
        @click="collapseDescription"
      >
        <span
          class="sidebar-description__mark sidebar-description__mark--up"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const LINE_HEIGHT_PX = 28
const MAX_LINES = 3
const VERTICAL_PADDING_PX = 16
const HORIZONTAL_PADDING_PX = 8
const MARK_GUTTER_PX = 20
const ELLIPSIS = '...'

const props = withDefaults(defineProps<{
  text?: string | null
  label?: string
  emptyLabel?: string
}>(), {
  text: null,
  label: '説明',
  emptyLabel: '説明はありません',
})

const rootRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)
const expandRef = ref<HTMLButtonElement | null>(null)
const collapseRef = ref<HTMLButtonElement | null>(null)
const expanded = ref(false)
const overflows = ref(false)
const previewText = ref('')

const isPlaceholder = computed(() => !props.text?.trim())
const displayText = computed(() => (isPlaceholder.value ? props.emptyLabel : props.text ?? ''))
const collapsed = computed(() => overflows.value && !expanded.value)
const showCollapse = computed(() => overflows.value && expanded.value)

function expandDescription () {
  expanded.value = true
  nextTick(() => collapseRef.value?.focus({ preventScroll: true }))
}
function collapseDescription () {
  expanded.value = false
  nextTick(() => expandRef.value?.focus({ preventScroll: true }))
}

function lineCountOf (el: HTMLElement): number {
  const contentHeight = el.scrollHeight - VERTICAL_PADDING_PX
  return Math.round(contentHeight / LINE_HEIGHT_PX)
}

function fitsInThreeLines (el: HTMLElement): boolean {
  const limit = VERTICAL_PADDING_PX + LINE_HEIGHT_PX * MAX_LINES
  return el.scrollHeight <= limit + 1
}

/** 矢印分の右余白を含めて、3行に収まる最長の本文 + "..." を返す */
function truncateToPreview (el: HTMLElement, text: string): string {
  el.style.paddingRight = `${HORIZONTAL_PADDING_PX + MARK_GUTTER_PX}px`
  const fits = (value: string) => {
    el.textContent = value
    return fitsInThreeLines(el)
  }
  if (fits(ELLIPSIS)) {
    let low = 0
    let high = text.length
    let best = 0
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const candidate = text.slice(0, mid).replace(/\s+$/u, '') + ELLIPSIS
      if (fits(candidate)) {
        best = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return text.slice(0, best).replace(/\s+$/u, '') + ELLIPSIS
  }
  return ELLIPSIS
}

function measure () {
  const root = rootRef.value
  const el = measureRef.value
  const surface = root?.querySelector('.sidebar-description__surface')
  if (!el || !root || !(surface instanceof HTMLElement) || isPlaceholder.value || surface.clientWidth === 0) {
    if (isPlaceholder.value) {
      overflows.value = false
      expanded.value = false
      previewText.value = ''
    }
    return
  }
  el.style.width = `${surface.offsetWidth}px`
  el.style.paddingRight = `${HORIZONTAL_PADDING_PX}px`
  el.textContent = displayText.value
  const nextOverflows = lineCountOf(el) >= MAX_LINES + 1
  overflows.value = nextOverflows
  if (!nextOverflows) {
    expanded.value = false
    previewText.value = ''
    return
  }
  previewText.value = truncateToPreview(el, displayText.value)
}

watch(displayText, () => {
  expanded.value = false
  nextTick(measure)
})

let resizeObserver: ResizeObserver | null = null
let alive = true
onMounted(() => {
  measure()
  document.fonts?.ready.then(() => {
    if (alive) measure()
  })
  if (rootRef.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(rootRef.value)
  }
})
onBeforeUnmount(() => {
  alive = false
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/ui/SidebarDescription.scss"></style>
