<template>
  <BaseModal
    :model-value="modelValue"
    title="ユーザー招待"
    aria-label="ユーザー招待"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(512px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="user-invite-modal-body" novalidate @submit.prevent="submit" @keydown="onFormKeydown">
      <label class="field">
        <span>メールアドレス</span>
        <input
          v-model="email"
          type="text"
          inputmode="email"
          :maxlength="EMAIL_MAX_LENGTH"
          autocomplete="email"
          placeholder="user@example.com"
          :disabled="loading"
          aria-required="true"
        >
        <p v-if="emailError" class="field-error">{{ emailError }}</p>
      </label>
      <fieldset class="roles" :disabled="loading">
        <legend class="roles-legend">ロール</legend>
        <ul class="role-list" role="listbox" aria-label="ロール">
          <li
            v-for="option in roleOptions"
            :key="option.value"
            role="option"
            :aria-selected="role === option.value"
          >
            <button
              type="button"
              class="role-option"
              :disabled="loading"
              @click="role = option.value"
            >
              <span
                class="role-checkbox"
                :class="{ 'role-checkbox--checked': role === option.value }"
                aria-hidden="true"
              >
                <span v-if="role === option.value">✓</span>
              </span>
              <span class="role-label">{{ option.label }}</span>
            </button>
          </li>
        </ul>
      </fieldset>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading">
          {{ loading ? '送信中…' : '送信' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import { EMAIL_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { emailFieldError } from '../../utils/formValidation'
import { isCtrlEnterKeydown } from '../../utils/uiInteraction'
import BaseModal from './BaseModal.vue'

type InviteRole = 'admin' | 'member'

const roleOptions: Array<{ value: InviteRole; label: string }> = [
  { value: 'member', label: 'メンバー' },
  { value: 'admin', label: '管理者' },
]

const props = withDefaults(defineProps<{
  modelValue: boolean
  loading?: boolean
}>(), {
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ email: string; role: InviteRole }]
}>()

const email = ref('')
const role = ref<InviteRole>('member')
const emailError = ref<string | null>(null)
const submitError = ref<string | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      email.value = ''
      role.value = 'member'
      emailError.value = null
      submitError.value = null
    }
  },
)

watch(email, () => {
  if (emailError.value) {
    emailError.value = null
  }
  if (submitError.value) {
    submitError.value = null
  }
})

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function submit () {
  if (props.loading) return
  const validationError = emailFieldError(email.value)
  if (validationError) {
    emailError.value = validationError
    return
  }
  emailError.value = null
  submitError.value = null
  emit('submit', { email: email.value.trim(), role: role.value })
}

function onFormKeydown (event: KeyboardEvent) {
  if (!isCtrlEnterKeydown(event)) return
  event.preventDefault()
  submit()
}

function setSubmitError (message: string) {
  submitError.value = message
}

syncAppLoadingCursor(() => props.loading)
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/UserInviteModal.scss"></style>
