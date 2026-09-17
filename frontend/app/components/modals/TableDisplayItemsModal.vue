<template>
  <BaseModal
    :model-value="modelValue"
    title="表示項目"
    aria-label="表示項目"
    width="min(400px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="table-display-items-modal">
      <div class="table-display-items-modal__toolbar">
        <button
          type="button"
          class="table-display-items-modal__select-all"
          @click="selectAll"
        >
          すべて選択
        </button>
      </div>
      <ul
        class="table-display-items-modal__list"
        role="listbox"
        aria-multiselectable="true"
        aria-label="表示する項目"
      >
        <li
          v-for="item in items"
          :key="item.key"
          class="table-display-items-modal__item"
          role="option"
          :aria-selected="isChecked(item.key)"
          :aria-disabled="isRequired(item.key) || undefined"
        >
          <button
            type="button"
            class="table-display-items-modal__option"
            :class="{ 'table-display-items-modal__option--required': isRequired(item.key) }"
            :disabled="isRequired(item.key)"
            @click="toggle(item.key)"
          >
            <span
              class="table-display-items-modal__checkbox"
              :class="{
                'table-display-items-modal__checkbox--checked': isChecked(item.key),
                'table-display-items-modal__checkbox--required': isRequired(item.key),
              }"
              aria-hidden="true"
            >
              <span v-if="isChecked(item.key)">✓</span>
            </span>
            <span class="table-display-items-modal__label">{{ item.label }}</span>
            <Lock
              v-if="isRequired(item.key)"
              class="table-display-items-modal__lock"
              :size="14"
              :stroke-width="2.25"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
      <div class="table-display-items-modal__actions">
        <button
          type="button"
          class="ghost-btn ghost-btn--pill"
          @click="close"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="primary-btn primary-btn--pill"
          @click="submit"
        >
          保存
        </button>
      </div>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import {
  TABLE_DISPLAY_ITEMS,
  type TableDisplayItemDef,
  type TableDisplayItemKey,
} from '../../composables/useTableColumnResize'

const props = defineProps<{
  modelValue: boolean
  selectedKeys: TableDisplayItemKey[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [keys: TableDisplayItemKey[]]
}>()

const items: readonly TableDisplayItemDef[] = TABLE_DISPLAY_ITEMS
const REQUIRED_ITEM_KEY: TableDisplayItemKey = 'title'
const draftKeys = ref<TableDisplayItemKey[]>([])

watch(
  () => [props.modelValue, props.selectedKeys] as const,
  ([open, selectedKeys]) => {
    if (!open) {
      return
    }
    draftKeys.value = orderKeys(selectedKeys)
  },
  { immediate: true },
)

function isRequired (key: TableDisplayItemKey) {
  return key === REQUIRED_ITEM_KEY
}

function orderKeys (keys: TableDisplayItemKey[]): TableDisplayItemKey[] {
  const selected = new Set(keys)
  selected.add(REQUIRED_ITEM_KEY)
  return TABLE_DISPLAY_ITEMS.map(item => item.key).filter(key => selected.has(key))
}

function isChecked (key: TableDisplayItemKey) {
  return draftKeys.value.includes(key)
}

function toggle (key: TableDisplayItemKey) {
  if (isRequired(key)) {
    return
  }
  if (isChecked(key)) {
    draftKeys.value = draftKeys.value.filter(item => item !== key)
  } else {
    draftKeys.value = orderKeys([...draftKeys.value, key])
  }
}

function selectAll () {
  draftKeys.value = TABLE_DISPLAY_ITEMS.map(item => item.key)
}

function close () {
  emit('update:modelValue', false)
}

function submit () {
  emit('save', orderKeys(draftKeys.value))
  emit('update:modelValue', false)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/TableDisplayItemsModal.scss"></style>
