<template>
  <BaseModal
    :model-value="modelValue"
    title="表示項目設定"
    aria-label="表示項目設定"
    width="min(560px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <div class="wbs-display-items-modal">
      <p class="wbs-display-items-modal__lead">
        WBSに表示する項目を選択できます。タスク名は常に表示されます。
      </p>

      <div class="wbs-display-items-modal__toolbar">
        <span class="wbs-display-items-modal__count">
          {{ selectedCount }} / {{ items.length }} 件選択中
        </span>
        <button
          type="button"
          class="wbs-display-items-modal__text-btn"
          :disabled="allSelected"
          @click="selectAll"
        >
          すべて選択
        </button>
      </div>

      <div
        class="wbs-display-items-modal__lists"
        role="listbox"
        aria-multiselectable="true"
        aria-label="表示する項目"
      >
        <ul class="wbs-display-items-modal__list wbs-display-items-modal__list--required">
          <li
            v-for="item in requiredItems"
            :key="item.key"
            class="wbs-display-items-modal__item wbs-display-items-modal__item--required"
            role="option"
            :aria-selected="isChecked(item.key)"
            aria-disabled="true"
          >
            <button
              type="button"
              class="wbs-display-items-modal__option wbs-display-items-modal__option--checked wbs-display-items-modal__option--required"
              disabled
            >
              <span
                class="wbs-display-items-modal__checkbox wbs-display-items-modal__checkbox--checked wbs-display-items-modal__checkbox--required"
                aria-hidden="true"
              >
                <span>✓</span>
              </span>
              <span class="wbs-display-items-modal__label">{{ item.label }}</span>
              <span class="wbs-display-items-modal__badge">
                <Lock
                  :size="16"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
                必須
              </span>
            </button>
          </li>
        </ul>

        <ul class="wbs-display-items-modal__list wbs-display-items-modal__list--optional">
          <li
            v-for="item in optionalItems"
            :key="item.key"
            class="wbs-display-items-modal__item"
            role="option"
            :aria-selected="isChecked(item.key)"
          >
            <button
              type="button"
              class="wbs-display-items-modal__option"
              :class="{ 'wbs-display-items-modal__option--checked': isChecked(item.key) }"
              @click="toggle(item.key)"
            >
              <span
                class="wbs-display-items-modal__checkbox"
                :class="{ 'wbs-display-items-modal__checkbox--checked': isChecked(item.key) }"
                aria-hidden="true"
              >
                <span>✓</span>
              </span>
              <span class="wbs-display-items-modal__label">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </div>

      <ModalFooterActions
        @cancel="close"
        @confirm="submit"
      />
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import {
  WBS_DISPLAY_ITEMS,
  type WbsDisplayItemDef,
  type WbsDisplayItemKey,
} from '../../composables/useWbsColumnResize'

const props = defineProps<{
  modelValue: boolean
  selectedKeys: WbsDisplayItemKey[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [keys: WbsDisplayItemKey[]]
}>()

const items: readonly WbsDisplayItemDef[] = WBS_DISPLAY_ITEMS
const REQUIRED_ITEM_KEY: WbsDisplayItemKey = 'title'
const draftKeys = ref<WbsDisplayItemKey[]>([])

const requiredItems = computed(() => items.filter(item => item.key === REQUIRED_ITEM_KEY))
const optionalItems = computed(() => items.filter(item => item.key !== REQUIRED_ITEM_KEY))
const selectedCount = computed(() => draftKeys.value.length)
const allSelected = computed(() => draftKeys.value.length === items.length)

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

function orderKeys (keys: WbsDisplayItemKey[]): WbsDisplayItemKey[] {
  const selected = new Set(keys)
  selected.add(REQUIRED_ITEM_KEY)
  return WBS_DISPLAY_ITEMS.map(item => item.key).filter(key => selected.has(key))
}

function isChecked (key: WbsDisplayItemKey) {
  return draftKeys.value.includes(key)
}

function toggle (key: WbsDisplayItemKey) {
  if (key === REQUIRED_ITEM_KEY) {
    return
  }
  if (isChecked(key)) {
    draftKeys.value = draftKeys.value.filter(item => item !== key)
  } else {
    draftKeys.value = orderKeys([...draftKeys.value, key])
  }
}

function selectAll () {
  draftKeys.value = WBS_DISPLAY_ITEMS.map(item => item.key)
}

function close () {
  emit('update:modelValue', false)
}

function submit () {
  emit('save', orderKeys(draftKeys.value))
  emit('update:modelValue', false)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/WbsDisplayItemsModal.scss"></style>
