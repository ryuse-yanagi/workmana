<template>
  <BaseModal
    :model-value="modelValue"
    title="ユーザーの編集"
    aria-label="ユーザーの編集"
    :close-disabled="loading"
    width="min(560px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <form class="member-edit-modal-body" novalidate @submit.prevent>
      <div class="member-edit-modal__profile">
        <MemberAvatar
          v-if="member"
          :member="member"
          size="md"
          :decorative="false"
          :aria-label="`${member.name}のアイコン`"
        />
        <div class="member-edit-modal__identity">
          <p class="member-edit-modal__name">{{ member?.name || '—' }}</p>
          <p v-if="member?.email" class="member-edit-modal__email">{{ member.email }}</p>
        </div>
      </div>

      <RoleRadioGroup
        v-model="role"
        name="edit-member-role"
        :disabled="loading"
      />

      <p v-if="submitError" class="err">{{ submitError }}</p>
      <ModalFooterActions
        :confirm-text="loading ? '保存中…' : '保存'"
        :disabled="loading"
        :confirm-disabled="!canSubmit"
        @cancel="close"
        @confirm="submit"
      />
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../../composables/ui/useAppLoadingCursor'
import type { OrgMemberRole } from '../../../constants/membership'
import BaseModal from '../shared/BaseModal.vue'
import MemberAvatar from '../../ui/MemberAvatar.vue'

export type MemberEditMember = {
  id: number
  name: string
  email: string
  role?: string | null
  avatar_url?: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  member?: MemberEditMember | null
  loading?: boolean
}>(), {
  member: null,
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ role: OrgMemberRole }]
}>()

const role = ref<OrgMemberRole>('member')
const submitError = ref<string | null>(null)

const canSubmit = computed(() => {
  if (!props.member) return false
  const current = props.member.role === 'admin' ? 'admin' : 'member'
  return role.value !== current
})

watch(
  () => [props.modelValue, props.member] as const,
  ([open]) => {
    if (!open) return
    role.value = props.member?.role === 'admin' ? 'admin' : 'member'
    submitError.value = null
  },
)

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function submit () {
  if (props.loading || !canSubmit.value) return
  submitError.value = null
  emit('submit', { role: role.value })
}

function setSubmitError (message: string) {
  submitError.value = message
}

syncAppLoadingCursor(() => props.loading)
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/member/MemberEditModal.scss"></style>
