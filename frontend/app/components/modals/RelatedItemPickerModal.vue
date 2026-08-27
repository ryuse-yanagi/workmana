<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(540px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="related-item-picker-modal">
      <input
        v-model.trim="searchQuery"
        type="search"
        class="related-item-picker-modal__search"
        :placeholder="searchPlaceholder"
        :disabled="loading || candidatesLoading"
        aria-label="検索"
      />
      <p
        v-if="candidatesError"
        class="related-item-picker-modal__error"
      >{{ candidatesError }}</p>
      <p
        v-else-if="candidatesLoading"
        class="related-item-picker-modal__empty"
      >読み込み中...</p>
      <ul
        v-else
        class="related-item-picker-modal__list"
        role="listbox"
        aria-multiselectable="true"
      >
        <li
          v-for="item in filteredItems"
          :key="item.id"
          class="related-item-picker-modal__item"
          role="option"
          :aria-selected="isChecked(item.id)"
        >
          <button
            type="button"
            class="related-item-picker-modal__option"
            :disabled="loading"
            @click="toggleItem(item.id)"
          >
            <span
              class="related-item-picker-modal__checkbox"
              :class="{ 'related-item-picker-modal__checkbox--checked': isChecked(item.id) }"
              aria-hidden="true"
            >
              <span v-if="isChecked(item.id)">✓</span>
            </span>
            <span class="related-item-picker-modal__text">
              <span class="related-item-picker-modal__name">{{ item.name }}</span>
              <span
                v-if="item.description"
                class="related-item-picker-modal__description"
              >{{ item.description }}</span>
            </span>
          </button>
        </li>
        <li
          v-if="!filteredItems.length"
          class="related-item-picker-modal__empty-row"
        >
          <p class="related-item-picker-modal__empty">{{ emptyMessage }}</p>
        </li>
      </ul>
      <p
        v-if="submitError"
        class="related-item-picker-modal__error"
      >{{ submitError }}</p>
      <div class="actions">
        <button
          type="button"
          class="ghost-btn"
          :disabled="loading"
          @click="close"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="primary-btn"
          :disabled="loading"
          @click="submit"
        >
          {{ loading ? savingLabel : submitLabel }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
export type RelatedPickerItem = {
  id: number
  name: string
  description?: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  searchPlaceholder?: string
  emptyMessage?: string
  items: RelatedPickerItem[]
  initialSelectedIds?: number[]
  hiddenIds?: number[]
  candidatesLoading?: boolean
  candidatesError?: string | null
  loading?: boolean
  submitLabel?: string
  savingLabel?: string
}>(), {
  searchPlaceholder: '名前を検索...',
  emptyMessage: '該当する項目がありません。',
  initialSelectedIds: () => [],
  hiddenIds: () => [],
  candidatesLoading: false,
  candidatesError: null,
  loading: false,
  submitLabel: '保存',
  savingLabel: '保存中...',
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [ids: number[]]
}>()

const searchQuery = ref('')
const selectedIds = ref<number[]>([])
const submitError = ref<string | null>(null)

const availableItems = computed(() => {
  const hidden = new Set(props.hiddenIds)
  return props.items.filter(item => !hidden.has(item.id))
})

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return availableItems.value
  }
  return availableItems.value.filter((item) => {
    if (item.name.toLowerCase().includes(query)) {
      return true
    }
    return (item.description ?? '').toLowerCase().includes(query)
  })
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      return
    }
    searchQuery.value = ''
    selectedIds.value = [...props.initialSelectedIds]
    submitError.value = null
  },
)

function isChecked (id: number) {
  return selectedIds.value.includes(id)
}

function toggleItem (id: number) {
  if (props.loading) {
    return
  }
  if (isChecked(id)) {
    selectedIds.value = selectedIds.value.filter(itemId => itemId !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

function close () {
  if (props.loading) {
    return
  }
  emit('update:modelValue', false)
}

function submit () {
  if (props.loading) {
    return
  }
  submitError.value = null
  emit('submit', [...selectedIds.value])
}

function setSubmitError (message: string) {
  submitError.value = message
}

defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/RelatedItemPickerModal.scss"></style>
