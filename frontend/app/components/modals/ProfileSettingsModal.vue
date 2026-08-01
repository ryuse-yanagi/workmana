<template>
  <BaseModal
    :model-value="modelValue"
    title="プロフィール設定"
    aria-label="プロフィール設定"
    :close-disabled="nameLoading || avatarLoading"
    width="min(576px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="profile-settings-modal-body">
      <p class="profile-settings-modal-note">ユーザー名とアイコン画像を設定できます。</p>
      <form class="profile-name-form" novalidate @submit.prevent="saveProfileName">
        <label class="profile-field">
          <span>ユーザー名</span>
          <input
            v-model.trim="nameDraft"
            class="profile-input"
            type="text"
            :maxlength="USER_NAME_MAX_LENGTH"
            placeholder="表示名を入力してください"
            :disabled="nameLoading"
          />
          <p v-if="nameError" class="field-error">{{ nameError }}</p>
        </label>
        <div class="profile-button-row">
          <button type="submit" class="profile-primary-btn" :disabled="nameLoading">
            ユーザー名を保存
          </button>
          <button type="button" class="profile-ghost-btn" :disabled="nameLoading" @click="resetNameDraft">
            元に戻す
          </button>
        </div>
      </form>
      <div class="profile-row">
        <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" alt="ユーザーアイコン" class="avatar-image" />
        <div v-else class="avatar-placeholder">No Icon</div>
        <div class="profile-actions">
          <input type="file" accept="image/*" :disabled="avatarLoading" @change="onAvatarFileChange" />
          <p v-if="avatarError" class="field-error">{{ avatarError }}</p>
          <div class="profile-button-row">
            <button
              type="button"
              class="profile-primary-btn"
              :disabled="avatarLoading"
              @click="uploadAvatar"
            >
              アイコンを保存
            </button>
            <button
              type="button"
              class="profile-ghost-btn"
              :disabled="avatarLoading || !avatarPreviewUrl"
              @click="deleteAvatar"
            >
              削除
            </button>
          </div>
        </div>
      </div>
      <p v-if="message" class="profile-msg" :class="{ 'profile-msg--err': messageKind === 'err' }">
        {{ message }}
      </p>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { useApi } from '../../composables/useApi'
import { USER_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../utils/formValidation'
import BaseModal from './BaseModal.vue'
type MeResponse = {
  name?: string | null
  avatar_url?: string | null
}
const props = defineProps<{
  modelValue: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()
const { api } = useApi()
const avatarPreviewUrl = ref<string | null>(null)
const selectedAvatarFile = ref<File | null>(null)
const avatarLoading = ref(false)
const nameCurrent = ref('')
const nameDraft = ref('')
const nameLoading = ref(false)
const nameError = ref<string | null>(null)
const avatarError = ref<string | null>(null)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}
function notifyProfileUpdated (detail: { name?: string; avatar_url?: string | null }) {
  if (!import.meta.client) return
  window.dispatchEvent(new CustomEvent('tm:user-profile-updated', { detail }))
}
async function load () {
  const me = await api<MeResponse>('/me')
  nameCurrent.value = (me.name || '').trim()
  nameDraft.value = nameCurrent.value
  avatarPreviewUrl.value = me.avatar_url || null
  selectedAvatarFile.value = null
  nameError.value = null
  avatarError.value = null
  setMessage('', 'ok')
}
function resetNameDraft () {
  nameDraft.value = nameCurrent.value
  nameError.value = null
  setMessage('', 'ok')
}
watch(nameDraft, () => {
  if (nameError.value) {
    nameError.value = null
  }
})
async function saveProfileName () {
  if (nameLoading.value) return
  const validationError = requiredTextFieldError(nameDraft.value, '表示名を入力してください')
  if (validationError) {
    nameError.value = validationError
    return
  }
  const name = nameDraft.value.trim()
  nameError.value = null
  nameLoading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<{ name?: string | null }>('/me', {
      method: 'PATCH',
      body: { name },
    })
    const savedName = (res.name || '').trim()
    nameCurrent.value = savedName
    nameDraft.value = savedName
    setMessage('ユーザー名を更新しました。', 'ok')
    notifyProfileUpdated({ name: savedName, avatar_url: avatarPreviewUrl.value })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ユーザー名の更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    nameLoading.value = false
  }
}
function onAvatarFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedAvatarFile.value = file
  avatarError.value = null
  if (file) {
    avatarPreviewUrl.value = URL.createObjectURL(file)
    setMessage('画像を選択しました。保存を押してください。', 'ok')
  }
}
async function uploadAvatar () {
  if (avatarLoading.value) return
  if (!selectedAvatarFile.value) {
    avatarError.value = 'アイコン画像を選択してください'
    return
  }
  avatarError.value = null
  avatarLoading.value = true
  setMessage('', 'ok')
  try {
    const body = new FormData()
    body.append('avatar', selectedAvatarFile.value)
    const res = await api<{ avatar_url: string | null }>('/me/avatar', {
      method: 'POST',
      body,
    })
    avatarPreviewUrl.value = res.avatar_url
    selectedAvatarFile.value = null
    setMessage('アイコンを更新しました。', 'ok')
    notifyProfileUpdated({ name: nameCurrent.value, avatar_url: res.avatar_url })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'アイコン更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    avatarLoading.value = false
  }
}
async function deleteAvatar () {
  avatarLoading.value = true
  setMessage('', 'ok')
  try {
    await api('/me/avatar', { method: 'DELETE' })
    avatarPreviewUrl.value = null
    selectedAvatarFile.value = null
    setMessage('アイコンを削除しました。', 'ok')
    notifyProfileUpdated({ name: nameCurrent.value, avatar_url: null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'アイコン削除に失敗しました'
    setMessage(msg, 'err')
  } finally {
    avatarLoading.value = false
  }
}
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void load()
    }
  },
)
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/ProfileSettingsModal.scss"></style>
