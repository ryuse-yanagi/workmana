<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    width="min(496px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="named-color-item-delete-modal-body">
      <p class="named-color-item-delete-modal-message">
        <template v-if="itemName">
          「{{ itemName }}」を削除しますか？<br>
          この操作は取り消せません。
        </template>
        <template v-else>
          この{{ itemKind }}を削除しますか？<br>
          この操作は取り消せません。
        </template>
      </p>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="button" class="danger-btn danger-btn--pill" :disabled="loading" @click="submit">
          {{ loading ? '削除中...' : '削除' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  itemKind: string
  itemName?: string
  loading?: boolean
}>(), {
  itemName: '',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()
const submitError = ref<string | null>(null)
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      submitError.value = null
    }
  },
)
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  if (props.loading) return
  submitError.value = null
  emit('confirm')
}
function setSubmitError (message: string) {
  submitError.value = message
}
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped>
.named-color-item-delete-modal-body {
  padding: 14px 18.9px 18.9px;
}
.named-color-item-delete-modal-message {
  margin: 0;
  font-size: 12.6px;
  color: mixin.$text-sub;
  line-height: 1.45;
}
.err {
  margin: 10.5px 0 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 12.04px;
}
.actions {
  margin-top: 13.3px;
  display: flex;
  justify-content: center;
  gap: 7px;
}
.ghost-btn,
.danger-btn {
  @include mixin.btn-base;
}
.ghost-btn--pill,
.danger-btn--pill {
  @include mixin.btn-pill;
}
.ghost-btn {
  @include mixin.btn-ghost;
}
.danger-btn {
  background: mixin.$danger;
  color: #fff;
}
</style>
