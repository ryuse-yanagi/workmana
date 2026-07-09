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
      <form class="profile-name-form" @submit.prevent="saveProfileName">
        <label class="profile-field">
          <span>ユーザー名</span>
          <input
            v-model.trim="nameDraft"
            class="profile-input"
            type="text"
            :maxlength="USER_NAME_MAX_LENGTH"
            required
            placeholder="表示名を入力してください"
            :disabled="nameLoading"
          />
        </label>
        <div class="profile-button-row">
          <button type="submit" class="profile-primary-btn" :disabled="nameLoading || !nameDraft">
            {{ nameLoading ? '保存中...' : 'ユーザー名を保存' }}
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
          <div class="profile-button-row">
            <button
              type="button"
              class="profile-primary-btn"
              :disabled="avatarLoading || !selectedAvatarFile"
              @click="uploadAvatar"
            >
              {{ avatarLoading ? '保存中...' : 'アイコンを保存' }}
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
  setMessage('', 'ok')
}
function resetNameDraft () {
  nameDraft.value = nameCurrent.value
  setMessage('', 'ok')
}
async function saveProfileName () {
  const name = nameDraft.value.trim()
  if (!name) return
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
  if (file) {
    avatarPreviewUrl.value = URL.createObjectURL(file)
    setMessage('画像を選択しました。保存を押してください。', 'ok')
  }
}
async function uploadAvatar () {
  if (!selectedAvatarFile.value) return
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
<style lang="scss" scoped>
.profile-settings-modal-body {
  padding: 14px 16.1px 16.8px;
}
.profile-settings-modal-note {
  margin: 0 0 14px;
  color: #64748b;
  font-size: 12.6px;
}
.profile-field {
  display: flex;
  flex-direction: column;
  gap: 4.9px;
  color: #1e293b;
  font-size: 12.6px;
  font-weight: 700;
}
.profile-input {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 7.7px 9.8px;
  font-size: 13.3px;
  background: #fff;
  &:focus {
    @include mixin.input-focus-ring;
  }
}
.profile-button-row {
  margin-top: 7.7px;
  display: flex;
  gap: 7px;
}
.profile-primary-btn,
.profile-ghost-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 11.2px;
  font-size: 12.04px;
  font-weight: 700;
  cursor: pointer;
}
.profile-primary-btn {
  background: mixin.$main;
  color: mixin.$white;
}
.profile-ghost-btn {
  background: #fff;
  color: #334155;
  border-color: #94a3b8;
}
.profile-primary-btn:disabled,
.profile-ghost-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.profile-row {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: 14px;
}
.profile-name-form {
  max-width: 476px;
}
.avatar-image,
.avatar-placeholder {
  width: 84px;
  height: 84px;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
}
.avatar-image {
  object-fit: cover;
  background: #fff;
}
.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #f8fafc;
  font-size: 11.2px;
}
.profile-actions {
  flex: 1;
}
.profile-msg {
  margin: 11.9px 0 0;
  color: #0f766e;
  font-weight: 700;
}
.profile-msg--err {
  color: #b91c1c;
}
</style>
