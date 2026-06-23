<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    width="min(36rem, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="project-create-modal-body" @submit.prevent="submit">
      <label class="field">
        <span>{{ workUnitLabel }}名</span>
        <input
          v-model.trim="name"
          type="text"
          required
          minlength="2"
          :maxlength="PROJECT_NAME_MAX_LENGTH"
          :placeholder="`${workUnitLabel}名を入力してください`"
          :disabled="loading"
        />
      </label>

      <label class="field">
        <span>ラベル（複数選択）</span>
        <div class="label-picker">
          <label v-for="label in labels" :key="label.id" class="label-option">
            <input
              v-model="labelIds"
              type="checkbox"
              :value="label.id"
              :disabled="loading"
            />
            <span class="label-dot" :style="{ backgroundColor: label.color }" />
            <span>{{ label.name }}</span>
          </label>
          <p v-if="!labels.length" class="label-empty">ラベルは設定画面から作成できます。</p>
        </div>
      </label>

      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading || name.length < 2">
          {{ loading ? '作成中...' : '登録' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { PROJECT_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
export type ProjectCreateLabel = { id: number; name: string; color: string }

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  workUnitLabel: string
  labels: ProjectCreateLabel[]
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; label_ids: number[] }]
}>()

const name = ref('')
const labelIds = ref<number[]>([])

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
      labelIds.value = []
    }
  },
)

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function submit () {
  const trimmed = name.value.trim()
  if (trimmed.length < 2 || props.loading) return
  emit('submit', { name: trimmed, label_ids: [...labelIds.value] })
}
</script>

<style lang="scss" scoped>
.project-create-modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #1e293b;
  font-weight: 700;
}

.field input[type='text'] {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.94rem;
  background: #fff;

  &:focus {
    @include mixin.input-focus-ring;
  }
}

.label-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.label-option {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: #fff;
}

.label-empty {
  margin: 0.1rem 0 0;
  color: #64748b;
  font-size: 0.82rem;
}

.label-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.actions {
  margin-top: 0.2rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ghost-btn,
.primary-btn {
  @include mixin.btn-base;
}

.ghost-btn--pill,
.primary-btn--pill {
  @include mixin.btn-pill;
}

.ghost-btn {
  @include mixin.btn-ghost;
}

.primary-btn {
  @include mixin.btn-primary;
}
</style>
