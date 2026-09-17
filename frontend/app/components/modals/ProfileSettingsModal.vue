<template>
  <BaseModal
    :model-value="modelValue"
    title="プロフィール設定"
    aria-label="プロフィール設定"
    :close-disabled="loading"
    width="min(576px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="profile-settings-modal-body" novalidate @submit.prevent="save">
      <div class="profile-avatar-section">
        <div class="profile-avatar-row">
          <img
            v-if="displayAvatarSrc"
            :src="displayAvatarSrc"
            alt="ユーザーアイコン"
            class="avatar-image"
            @error="onAvatarImageError"
          />
          <div v-else class="avatar-placeholder" aria-label="デフォルトアイコン">
            <span class="avatar-placeholder__initial">{{ avatarInitial }}</span>
          </div>
          <div class="profile-avatar-actions">
            <input
              ref="avatarFileInputRef"
              class="profile-avatar-file-input"
              type="file"
              accept="image/*"
              :disabled="loading"
              @change="onAvatarFileChange"
            />
            <button
              type="button"
              class="profile-avatar-dropzone"
              :class="{ 'profile-avatar-dropzone--active': avatarDropActive }"
              :disabled="loading"
              @click="openAvatarFileDialog"
              @dragenter.prevent="onAvatarDragEnter"
              @dragover.prevent="onAvatarDragOver"
              @dragleave.prevent="onAvatarDragLeave"
              @drop.prevent="onAvatarDrop"
            >
              <svg
                class="profile-avatar-dropzone__icon"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                aria-hidden="true"
              >
                <path
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7.5 18a4.5 4.5 0 0 1 .35-8.98A5.5 5.5 0 0 1 18.2 10.6 3.5 3.5 0 0 1 19.5 18H7.5z"
                />
                <path
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 15.25V9.75M12 9.75 9.75 12M12 9.75 14.25 12"
                />
              </svg>
              <span class="profile-avatar-dropzone__text">
                <span class="profile-avatar-dropzone__title">画像を選択してアイコンを変更</span>
                <span class="profile-avatar-dropzone__hint">またはドラッグ＆ドロップ</span>
              </span>
            </button>
            <button
              type="button"
              class="profile-avatar-reset-btn"
              :disabled="loading || !canResetAvatar"
              @click="resetAvatarToDefault"
            >
              デフォルトに戻す
            </button>
            <p v-if="avatarError" class="field-error">{{ avatarError }}</p>
          </div>
        </div>
      </div>

      <div class="profile-fields">
        <label class="profile-field">
          <span>表示名</span>
          <input
            v-model.trim="nameDraft"
            class="profile-input"
            type="text"
            :maxlength="USER_NAME_MAX_LENGTH"
            placeholder="表示名を入力..."
            :disabled="loading"
          />
          <p v-if="nameError" class="field-error">{{ nameError }}</p>
        </label>

        <label class="profile-field">
          <span>メールアドレス</span>
          <input
            v-model.trim="emailDraft"
            class="profile-input"
            type="email"
            :maxlength="EMAIL_MAX_LENGTH"
            placeholder="メールアドレスを入力..."
            :disabled="loading"
          />
          <p v-if="emailError" class="field-error">{{ emailError }}</p>
        </label>

        <p v-if="submitError" class="err">{{ submitError }}</p>
      </div>

      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading">
          {{ loading ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import { useApi } from '../../composables/useApi'
import { useCurrentUser } from '../../composables/useCurrentUser'
import { memberInitial } from '../../composables/useMemberDisplay'
import { dispatchUserProfileUpdated } from '../../composables/userProfileUpdated'
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { emailFieldError, requiredTextFieldError } from '../../utils/formValidation'
import { resolveAvatarUrl } from '../../utils/resolveAvatarUrl'
import BaseModal from './BaseModal.vue'

type MeResponse = {
  id?: number
  name?: string | null
  email?: string | null
  avatar_url?: string | null
}

const props = defineProps<{
  modelValue: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const { api } = useApi()
const { currentUserId, ensureCurrentUser, setCurrentUserId } = useCurrentUser()

const config = useRuntimeConfig()
const avatarFileInputRef = ref<HTMLInputElement | null>(null)
const avatarPreviewUrl = ref<string | null>(null)
const avatarCurrentUrl = ref<string | null>(null)
const selectedAvatarFile = ref<File | null>(null)
const avatarResetPending = ref(false)
const localPreviewObjectUrl = ref<string | null>(null)
const avatarImageFailed = ref(false)
const avatarDropActive = ref(false)
const avatarDragDepth = ref(0)
const profileUserId = ref(0)

const nameCurrent = ref('')
const nameDraft = ref('')
const emailCurrent = ref('')
const emailDraft = ref('')

const loading = ref(false)
const nameError = ref<string | null>(null)
const emailError = ref<string | null>(null)
const avatarError = ref<string | null>(null)
const submitError = ref<string | null>(null)

const displayAvatarSrc = computed(() => {
  if (avatarImageFailed.value || !avatarPreviewUrl.value) {
    return null
  }
  if (localPreviewObjectUrl.value && avatarPreviewUrl.value === localPreviewObjectUrl.value) {
    return avatarPreviewUrl.value
  }
  return resolveAvatarUrl(
    avatarPreviewUrl.value,
    String(config.public.apiBaseUrl || '/api'),
  )
})

const canResetAvatar = computed(() => Boolean(displayAvatarSrc.value))

const avatarInitial = computed(() => memberInitial({
  id: profileUserId.value || currentUserId.value || 0,
  name: nameDraft.value || nameCurrent.value,
  email: emailDraft.value || emailCurrent.value,
}))

syncAppLoadingCursor(loading)

function onAvatarImageError () {
  avatarImageFailed.value = true
}

function revokeLocalPreview () {
  if (localPreviewObjectUrl.value) {
    URL.revokeObjectURL(localPreviewObjectUrl.value)
    localPreviewObjectUrl.value = null
  }
}

function clearErrors () {
  nameError.value = null
  emailError.value = null
  avatarError.value = null
  submitError.value = null
}

async function notifyProfileUpdated (detail: { name?: string; avatar_url?: string | null }) {
  let id = currentUserId.value
  if (!id) {
    id = await ensureCurrentUser()
  }
  if (!id) {
    return
  }
  dispatchUserProfileUpdated({ id, ...detail })
}

async function load () {
  const [me] = await Promise.all([
    api<MeResponse>('/me'),
    ensureCurrentUser(),
  ])
  if (typeof me.id === 'number') {
    profileUserId.value = me.id
    setCurrentUserId(me.id)
  }
  nameCurrent.value = (me.name || '').trim()
  nameDraft.value = nameCurrent.value
  emailCurrent.value = (me.email || '').trim()
  emailDraft.value = emailCurrent.value
  avatarCurrentUrl.value = me.avatar_url || null
  avatarPreviewUrl.value = avatarCurrentUrl.value
  selectedAvatarFile.value = null
  avatarResetPending.value = false
  avatarImageFailed.value = false
  avatarDropActive.value = false
  avatarDragDepth.value = 0
  revokeLocalPreview()
  if (avatarFileInputRef.value) {
    avatarFileInputRef.value.value = ''
  }
  clearErrors()
}

function close () {
  if (loading.value) return
  emit('update:modelValue', false)
}

function openAvatarFileDialog () {
  if (loading.value) return
  avatarFileInputRef.value?.click()
}

function applyAvatarFile (file: File | null) {
  avatarError.value = null
  submitError.value = null
  if (!file) {
    return
  }
  if (!file.type.startsWith('image/')) {
    avatarError.value = '画像ファイルを選択してください'
    return
  }
  revokeLocalPreview()
  selectedAvatarFile.value = file
  avatarResetPending.value = false
  avatarImageFailed.value = false
  const objectUrl = URL.createObjectURL(file)
  localPreviewObjectUrl.value = objectUrl
  avatarPreviewUrl.value = objectUrl
}

function onAvatarFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  applyAvatarFile(input.files?.[0] ?? null)
}

function onAvatarDragEnter () {
  if (loading.value) return
  avatarDragDepth.value += 1
  avatarDropActive.value = true
}

function onAvatarDragOver () {
  if (loading.value) return
  avatarDropActive.value = true
}

function onAvatarDragLeave () {
  avatarDragDepth.value = Math.max(0, avatarDragDepth.value - 1)
  if (avatarDragDepth.value === 0) {
    avatarDropActive.value = false
  }
}

function onAvatarDrop (event: DragEvent) {
  avatarDragDepth.value = 0
  avatarDropActive.value = false
  if (loading.value) return
  const file = event.dataTransfer?.files?.[0] ?? null
  applyAvatarFile(file)
}

function resetAvatarToDefault () {
  if (loading.value || !canResetAvatar.value) return
  avatarError.value = null
  submitError.value = null
  selectedAvatarFile.value = null
  avatarResetPending.value = Boolean(avatarCurrentUrl.value)
  avatarImageFailed.value = false
  revokeLocalPreview()
  avatarPreviewUrl.value = null
  if (avatarFileInputRef.value) {
    avatarFileInputRef.value.value = ''
  }
}

watch(nameDraft, () => {
  if (nameError.value) nameError.value = null
  if (submitError.value) submitError.value = null
})
watch(emailDraft, () => {
  if (emailError.value) emailError.value = null
  if (submitError.value) submitError.value = null
})

async function save () {
  if (loading.value) return

  const nameValidation = requiredTextFieldError(nameDraft.value, '表示名', USER_NAME_MAX_LENGTH)
  const emailValidation = emailFieldError(emailDraft.value)
  nameError.value = nameValidation
  emailError.value = emailValidation
  avatarError.value = null
  submitError.value = null
  if (nameValidation || emailValidation) {
    return
  }

  const name = nameDraft.value.trim()
  const email = emailDraft.value.trim()
  loading.value = true

  try {
    let nextAvatarUrl: string | null = avatarCurrentUrl.value

    if (avatarResetPending.value) {
      const res = await api<{ avatar_url: string | null }>('/me/avatar', { method: 'DELETE' })
      nextAvatarUrl = res.avatar_url ?? null
      avatarResetPending.value = false
    } else if (selectedAvatarFile.value) {
      const body = new FormData()
      body.append('avatar', selectedAvatarFile.value)
      const res = await api<{ avatar_url: string | null }>('/me/avatar', {
        method: 'POST',
        body,
      })
      nextAvatarUrl = res.avatar_url
      selectedAvatarFile.value = null
      revokeLocalPreview()
    }

    const res = await api<{ name?: string | null; email?: string | null; avatar_url?: string | null }>('/me', {
      method: 'PATCH',
      body: { name, email },
    })

    const savedName = (res.name || '').trim()
    const savedEmail = (res.email || '').trim()
    nameCurrent.value = savedName
    nameDraft.value = savedName
    emailCurrent.value = savedEmail
    emailDraft.value = savedEmail
    avatarCurrentUrl.value = res.avatar_url ?? nextAvatarUrl
    avatarPreviewUrl.value = avatarCurrentUrl.value

    await notifyProfileUpdated({ name: savedName, avatar_url: avatarCurrentUrl.value })
    emit('update:modelValue', false)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'プロフィールの更新に失敗しました'
    submitError.value = msg
  } finally {
    loading.value = false
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

onBeforeUnmount(() => {
  revokeLocalPreview()
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/ProfileSettingsModal.scss"></style>
