<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div v-if="modelValue" class="modal-overlay" role="presentation" @click.self="close">
      <section
        class="modal-card"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button type="button" class="icon-close" :disabled="loading" @click="close">✕</button>
        </header>

        <form class="modal-body" @submit.prevent="submit">
          <label class="field">
            <span>ラベル名</span>
            <input
              v-model.trim="name"
              type="text"
              maxlength="40"
              required
              placeholder="ラベル名"
              :disabled="loading"
            />
          </label>

          <div class="field">
            <span>カラー</span>
            <div class="color-list">
              <button
                v-for="colorItem in colorPresets"
                :key="colorItem"
                type="button"
                class="color-btn"
                :class="{ 'color-btn--active': colorItem === color }"
                :style="{ backgroundColor: colorItem }"
                :disabled="loading"
                @click="color = colorItem"
              />
            </div>
          </div>

          <div class="actions">
            <button type="button" class="ghost-btn" :disabled="loading" @click="close">キャンセル</button>
            <button type="submit" class="primary-btn" :disabled="loading || !name">追加</button>
          </div>
        </form>
      </section>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; color: string }]
}>()

const colorPresets: string[] = [
  '#c084fc',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#34d399',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
]
const defaultColor = '#c084fc'

const name = ref('')
const color = ref<string>(defaultColor)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
      color.value = defaultColor
    }
  },
)

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function submit () {
  const trimmed = name.value.trim()
  if (!trimmed || props.loading) return
  emit('submit', { name: trimmed, color: color.value })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  z-index: 70;
}

.modal-card {
  width: min(32rem, 100%);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.modal-header {
  background: #0b2bab;
  color: #fff;
  padding: 0.7rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.icon-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: -0.2rem 0;
}

.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #1e293b;
  font-weight: 700;
}

.field input {
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.94rem;
}

.color-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.color-btn {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  cursor: pointer;
}

.color-btn--active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #334155;
}

.actions {
  margin-top: 0.2rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.primary-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.45rem 1.4rem;
  font-weight: 800;
  cursor: pointer;
}

.primary-btn {
  background: #45c3cf;
  color: #fff;
}

.ghost-btn {
  border-color: #cbd5e1;
  color: #64748b;
  background: #f1f5f9;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
