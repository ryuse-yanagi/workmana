<template>
  <BaseModal
    :model-value="modelValue"
    title="ユーザーの編集"
    aria-label="ユーザーの編集"
    :close-disabled="loading"
    width="min(512px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="member-edit-modal-body" novalidate @submit.prevent="submit">
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

      <fieldset class="member-edit-modal__roles" :disabled="loading">
        <legend class="member-edit-modal__roles-legend">ロール</legend>
        <ul class="member-edit-modal__role-list" role="listbox" aria-label="ロール">
          <li
            v-for="option in roleOptions"
            :key="option.value"
            role="option"
            :aria-selected="role === option.value"
          >
            <button
              type="button"
              class="member-edit-modal__role-option"
              :disabled="loading"
              @click="role = option.value"
            >
              <span
                class="member-edit-modal__checkbox"
                :class="{ 'member-edit-modal__checkbox--checked': role === option.value }"
                aria-hidden="true"
              >
                <span v-if="role === option.value">✓</span>
              </span>
              <span class="member-edit-modal__role-label">{{ option.label }}</span>
            </button>
          </li>
        </ul>
      </fieldset>

      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading || !canSubmit">
          {{ loading ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import BaseModal from './BaseModal.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'

type InviteRole = 'admin' | 'member'

export type MemberEditMember = {
  id: number
  name: string
  email: string
  role?: string | null
  avatar_url?: string | null
}

const roleOptions: Array<{ value: InviteRole; label: string }> = [
  { value: 'member', label: 'メンバー' },
  { value: 'admin', label: '管理者' },
]

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
  submit: [{ role: InviteRole }]
}>()

const role = ref<InviteRole>('member')
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
<style lang="scss" scoped src="~/assets/styles/components/modals/MemberEditModal.scss"></style>
