<template>
  <PopoverShell
    ref="shellRef"
    :shell-class="[
      'popover',
      'popover--description',
      { 'popover--description-edit': !readonly },
    ]"
    :style="style"
    title="説明"
    aria-label="説明"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <template v-if="readonly">
      <div class="description-view popover-scroll">
        <p
          v-if="text.trim()"
          class="description-preview"
        >{{ text }}</p>
        <p
          v-else
          class="empty-text description-view-empty"
        >説明はありません。</p>
      </div>
    </template>
    <template v-else>
      <div class="description-body">
        <textarea
          ref="inputRef"
          :value="draft"
          class="description-input"
          rows="6"
          :maxlength="maxLength"
          placeholder="説明を入力..."
          aria-label="説明"
          :disabled="disabled || saving"
          spellcheck="false"
          @input="$emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
          @blur="$emit('blur-save')"
        />
        <p v-if="error" class="err">{{ error }}</p>
      </div>
    </template>
  </PopoverShell>
</template>

<script setup lang="ts">
import PopoverShell from '../../ui/PopoverShell.vue'
import { schedulePopoverInputFocus } from '../../../utils/ui/schedulePopoverInputFocus'

const props = withDefaults(defineProps<{
  style?: Record<string, string>
  disabled?: boolean
  saving?: boolean
  canClear?: boolean
  error?: string | null
  readonly?: boolean
  draft?: string
  text?: string
  maxLength: number
}>(), {
  disabled: false,
  saving: false,
  canClear: false,
  error: null,
  readonly: false,
  draft: '',
  text: '',
})

defineEmits<{
  close: []
  clear: []
  'update:draft': [value: string]
  'blur-save': []
}>()

const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

onMounted(() => {
  if (props.readonly) {
    return
  }
  schedulePopoverInputFocus(() => inputRef.value, { select: 'end' })
})

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
  get inputRef () {
    return inputRef.value
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
