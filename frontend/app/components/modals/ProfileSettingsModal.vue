<template>
  <BaseModal
    :model-value="modelValue"
    title="プロフィール設定"
    aria-label="プロフィール設定"
    :close-disabled="nameLoading || avatarLoading"
    width="min(36rem, 100%)"
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
            maxlength="255"
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
  padding: 1rem 1.15rem 1.2rem;
}

.profile-settings-modal-note {
  margin: 0 0 1rem;
  color: #64748b;
  font-size: 0.9rem;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #1e293b;
  font-size: 0.9rem;
  font-weight: 700;
}

.profile-input {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.95rem;
  background: #fff;

  &:focus {
    @include mixin.input-focus-ring;
  }
}

.profile-button-row {
  margin-top: 0.55rem;
  display: flex;
  gap: 0.5rem;
}

.profile-primary-btn,
.profile-ghost-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  font-size: 0.86rem;
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
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
}

.profile-name-form {
  max-width: 34rem;
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
  font-size: 0.8rem;
}

.profile-actions {
  flex: 1;
}

.profile-msg {
  margin: 0.85rem 0 0;
  color: #0f766e;
  font-weight: 700;
}

.profile-msg--err {
  color: #b91c1c;
}
</style>
