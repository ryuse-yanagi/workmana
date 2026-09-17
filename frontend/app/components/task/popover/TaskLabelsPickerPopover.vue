<template>
  <PopoverShell
    ref="shellRef"
    shell-class="popover popover--labels"
    header-class="popover-header--labels"
    :style="style"
    title="ラベル"
    aria-label="ラベル"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <input
      ref="searchInputRef"
      v-model="searchQueryModel"
      type="search"
      class="label-search-input"
      placeholder="ラベルを検索..."
      :disabled="disabled"
      @click.stop
    />
    <div class="popover-scroll">
      <LabelPickerGroupedList
        :categories="categories"
        :selected-ids="selectedIds"
        :has-source-labels="hasSourceLabels"
        :disabled="disabled"
        @toggle="$emit('toggle', $event)"
      />
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </PopoverShell>
</template>

<script setup lang="ts">
import type { LabelCategoryGroup } from '../../../composables/useLabelCategories'
import type { TaskFormLabel } from '../../../composables/useTaskFormHelpers'
import PopoverShell from '../../ui/PopoverShell.vue'
import LabelPickerGroupedList from '../LabelPickerGroupedList.vue'
import { schedulePopoverInputFocus } from '../../../utils/schedulePopoverInputFocus'

const props = withDefaults(defineProps<{
  style?: Record<string, string>
  disabled?: boolean
  canClear?: boolean
  error?: string | null
  searchQuery?: string
  categories: LabelCategoryGroup[]
  selectedIds: number[]
  hasSourceLabels: boolean
}>(), {
  disabled: false,
  canClear: false,
  error: null,
  searchQuery: '',
})

const emit = defineEmits<{
  close: []
  clear: []
  'update:searchQuery': [query: string]
  toggle: [label: TaskFormLabel]
}>()

const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const searchQueryModel = computed({
  get: () => props.searchQuery,
  set: (query: string) => emit('update:searchQuery', query),
})

onMounted(() => {
  schedulePopoverInputFocus(() => searchInputRef.value)
})

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
  get inputRef () {
    return searchInputRef.value
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
