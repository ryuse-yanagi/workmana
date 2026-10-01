<template>
  <BaseModal
    :model-value="modelValue"
    title="ユーザー招待"
    aria-label="ユーザー招待"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(560px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <form class="user-invite-modal-body" novalidate @submit.prevent>
      <div class="field">
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
          @keydown.enter.exact.prevent
        >
        <p v-if="emailError" class="field-error">{{ emailError }}</p>
      </div>
      <RoleRadioGroup
        v-model="role"
        name="invite-role"
        :disabled="loading"
      />
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <ModalFooterActions
        confirm-text="送信"
        :disabled="loading"
        @cancel="close"
        @confirm="submit"
      />
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../../composables/ui/useAppLoadingCursor'
import { EMAIL_MAX_LENGTH } from '../../../constants/fieldLengthLimits'
import type { OrgMemberRole } from '../../../constants/membership'
import { emailFieldError } from '../../../utils/shared/formValidation'
import BaseModal from '../shared/BaseModal.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  loading?: boolean
}>(), {
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ email: string; role: OrgMemberRole }]
}>()

const email = ref('')
const role = ref<OrgMemberRole>('member')
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

function setSubmitError (message: string) {
  submitError.value = message
}

syncAppLoadingCursor(() => props.loading)
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/member/UserInviteModal.scss"></style>
