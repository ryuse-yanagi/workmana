<template>
  <PopoverShell
    ref="shellRef"
    shell-class="popover popover--status-category"
    header-class="popover-header--labels"
    :style="style"
    :title="title"
    :aria-label="ariaLabel ?? title"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <input
      v-model="searchQueryModel"
      type="search"
      class="label-search-input"
      :placeholder="searchPlaceholder"
      :disabled="disabled"
      @click.stop
    />
    <p
      v-if="sectionHeading"
      class="label-section-heading"
    >{{ sectionHeading }}</p>
    <div class="popover-scroll">
      <ul class="label-picker-list">
        <li
          v-for="item in items"
          :key="item.key"
        >
          <button
            type="button"
            class="label-picker-row"
            :disabled="disabled"
            @click.stop="$emit('select', item)"
          >
            <input
              type="radio"
              class="label-picker-radio"
              :checked="item.selected"
              tabindex="-1"
              aria-hidden="true"
            >
            <span
              class="label-picker-bar label-picker-bar--pill"
              :style="pillStyle?.(item) ?? {
                backgroundColor: item.color,
                color: colorPresetFillTextColor(item.color),
              }"
            >
              {{ item.name }}
            </span>
          </button>
        </li>
      </ul>
      <p
        v-if="!hasSourceItems"
        class="empty-text label-picker-empty"
      >
        {{ emptySourceMessage }}
      </p>
      <p
        v-else-if="!items.length"
        class="empty-text label-picker-empty"
      >
        {{ emptyFilterMessage }}
      </p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </PopoverShell>
</template>

<script setup lang="ts">
import PopoverShell from '../../ui/PopoverShell.vue'
import { colorPresetFillTextColor } from '../../../constants/colorPresets'
import type { TaskPopoverOptionItem } from '../../../utils/taskPopoverTypes'

const props = withDefaults(defineProps<{
  title: string
  ariaLabel?: string
  style?: Record<string, string>
  disabled?: boolean
  canClear?: boolean
  error?: string | null
  searchQuery?: string
  searchPlaceholder?: string
  sectionHeading?: string
  items: TaskPopoverOptionItem[]
  hasSourceItems: boolean
  emptySourceMessage: string
  emptyFilterMessage: string
  pillStyle?: (item: TaskPopoverOptionItem) => Record<string, string>
}>(), {
  disabled: false,
  canClear: false,
  error: null,
  searchQuery: '',
  searchPlaceholder: '検索...',
  sectionHeading: '',
  pillStyle: undefined,
})

const emit = defineEmits<{
  close: []
  clear: []
  'update:searchQuery': [query: string]
  select: [item: TaskPopoverOptionItem]
}>()

const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)

const searchQueryModel = computed({
  get: () => props.searchQuery,
  set: (query: string) => emit('update:searchQuery', query),
})

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
