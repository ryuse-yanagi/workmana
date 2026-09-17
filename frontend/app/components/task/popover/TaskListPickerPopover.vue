<template>
  <PopoverShell
    ref="shellRef"
    shell-class="popover popover--list"
    :style="style"
    title="リスト"
    aria-label="リスト"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <div class="popover-scroll">
      <ul class="list-picker-list">
        <li
          v-for="list in lists"
          :key="list.id"
        >
          <button
            v-if="variant === 'bar'"
            type="button"
            class="list-picker-bar"
            :class="{ 'list-picker-bar--selected': selectedId === list.id }"
            :style="barStyle?.(list) ?? undefined"
            :disabled="disabled"
            @click.stop="$emit('select', list.id)"
          >
            <span class="list-picker-bar__name">{{ list.name }}</span>
            <Check
              v-if="selectedId === list.id"
              class="list-picker-bar__check"
              :size="14"
              :stroke-width="2.5"
              aria-hidden="true"
            />
          </button>
          <button
            v-else
            type="button"
            class="list-picker-row"
            :class="{ 'list-picker-row--selected': selectedId === list.id }"
            :disabled="disabled"
            @click.stop="$emit('select', list.id)"
          >
            <input
              type="radio"
              class="list-picker-radio"
              :checked="selectedId === list.id"
              tabindex="-1"
              aria-hidden="true"
            >
            <span class="list-picker-label">{{ list.name }}</span>
          </button>
        </li>
      </ul>
      <p
        v-if="!lists.length"
        class="empty-text list-picker-empty"
      >
        該当するリストがありません
      </p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </PopoverShell>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import PopoverShell from '../../ui/PopoverShell.vue'
import type { TaskPopoverListOption } from '../../../utils/taskPopoverTypes'

withDefaults(defineProps<{
  style?: Record<string, string>
  disabled?: boolean
  canClear?: boolean
  error?: string | null
  lists: TaskPopoverListOption[]
  selectedId?: number | null
  variant?: 'radio' | 'bar'
  radioStyle?: 'check' | 'dot'
  barStyle?: (list: TaskPopoverListOption) => Record<string, string> | undefined
}>(), {
  disabled: false,
  canClear: false,
  error: null,
  selectedId: null,
  variant: 'radio',
  radioStyle: 'dot',
  barStyle: undefined,
})

defineEmits<{
  close: []
  clear: []
  select: [id: number]
}>()

const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
