<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div v-if="modelValue" class="modal-overlay" role="presentation" @click.self="close">
        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="親タスクの作成"
        >
          <header class="modal-header">
            <h3>親タスクの作成</h3>
            <button type="button" class="icon-close" :disabled="loading" @click="close">✕</button>
          </header>

          <form class="modal-body" @submit.prevent="submit">
            <label class="field">
              <span>親タスク名</span>
              <input
                v-model.trim="name"
                type="text"
                maxlength="80"
                required
                placeholder="親タスク名"
                :disabled="loading"
              />
            </label>

            <div class="actions">
              <button type="button" class="ghost-btn" :disabled="loading" @click="close">キャンセル</button>
              <button type="submit" class="primary-btn" :disabled="loading || !name">作成</button>
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
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string }]
}>()

const name = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
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
  emit('submit', { name: trimmed })
}
</script>

<style lang="scss" scoped>
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
  border: 1px solid #cbd5e1;
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
  background: mixin.$main;
  color: mixin.$white;
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
