<template>
  <BaseModal
    :model-value="modelValue"
    title="組織設定"
    aria-label="組織設定"
    :close-disabled="loading"
    width="min(560px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="org-settings-modal-body" novalidate @submit.prevent="save">
      <div class="org-icon-section">
        <div class="org-icon-block">
          <div class="org-icon-row">
            <div class="org-icon-preview">
              <img
                v-if="displayIconSrc"
                :src="displayIconSrc"
                alt="組織アイコン"
                class="icon-image"
                @error="onIconImageError"
              />
              <div v-else class="icon-placeholder" aria-label="デフォルトアイコン">
                <span class="icon-placeholder__initial">{{ iconInitial }}</span>
              </div>
            </div>
            <div class="org-icon-actions">
              <input
                ref="iconFileInputRef"
                class="org-icon-file-input"
                type="file"
                accept="image/*"
                :disabled="loading"
                @change="onIconFileChange"
              />
              <button
                type="button"
                class="org-icon-dropzone"
                :class="{ 'org-icon-dropzone--active': iconDropActive }"
                :disabled="loading"
                @click="openIconFileDialog"
                @dragenter.prevent="onIconDragEnter"
                @dragover.prevent="onIconDragOver"
                @dragleave.prevent="onIconDragLeave"
                @drop.prevent="onIconDrop"
              >
                <CloudUpload
                  class="org-icon-dropzone__icon"
                  :size="28"
                  :stroke-width="1.75"
                  aria-hidden="true"
                />
                <span class="org-icon-dropzone__text">
                  <span class="org-icon-dropzone__title">画像を選択してアイコンを変更</span>
                  <span class="org-icon-dropzone__hint">またはドラッグ＆ドロップ</span>
                </span>
              </button>
              <button
                type="button"
                class="org-icon-reset-btn"
                :disabled="loading || !canResetIcon"
                @click="resetIconToDefault"
              >
                デフォルトに戻す
              </button>
            </div>
          </div>
          <p v-if="iconError" class="field-error org-icon-error">{{ iconError }}</p>
        </div>
      </div>

      <div class="org-fields">
        <div class="org-field">
          <span>組織名</span>
          <input
            v-model.trim="nameDraft"
            class="org-input"
            type="text"
            :maxlength="ORGANIZATION_NAME_MAX_LENGTH"
            placeholder="組織名を入力..."
            :disabled="loading"
          />
          <p v-if="nameError" class="field-error">{{ nameError }}</p>
        </div>

        <p v-if="submitError" class="err">{{ submitError }}</p>
      </div>

      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading">
          保存
        </button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import { useApi } from '../../composables/useApi'
import { ORGANIZATION_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../utils/formValidation'
import { resolveAvatarUrl } from '../../utils/resolveAvatarUrl'
import type { OrgSettingsResponse } from '../settings/types'
import { CloudUpload } from 'lucide-vue-next'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  modelValue: boolean
  orgSlug: string
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: [payload: { name: string; icon_url: string | null }]
}>()

const { api } = useApi()
const config = useRuntimeConfig()

const iconFileInputRef = ref<HTMLInputElement | null>(null)
const iconPreviewUrl = ref<string | null>(null)
const iconCurrentUrl = ref<string | null>(null)
const selectedIconFile = ref<File | null>(null)
const iconResetPending = ref(false)
const localPreviewObjectUrl = ref<string | null>(null)
const iconImageFailed = ref(false)
const iconDropActive = ref(false)
const iconDragDepth = ref(0)

const nameCurrent = ref('')
const nameDraft = ref('')

const loading = ref(false)
const nameError = ref<string | null>(null)
const iconError = ref<string | null>(null)
const submitError = ref<string | null>(null)

const displayIconSrc = computed(() => {
  if (iconImageFailed.value || !iconPreviewUrl.value) {
    return null
  }
  if (localPreviewObjectUrl.value && iconPreviewUrl.value === localPreviewObjectUrl.value) {
    return iconPreviewUrl.value
  }
  return resolveAvatarUrl(
    iconPreviewUrl.value,
    String(config.public.apiBaseUrl || '/api'),
  )
})

const canResetIcon = computed(() => Boolean(displayIconSrc.value))

const iconInitial = computed(() => {
  const source = (nameDraft.value || nameCurrent.value || props.orgSlug || '?').trim()
  return Array.from(source)[0]?.toUpperCase() || '?'
})

syncAppLoadingCursor(loading)

function onIconImageError () {
  iconImageFailed.value = true
}

function revokeLocalPreview () {
  if (localPreviewObjectUrl.value) {
    URL.revokeObjectURL(localPreviewObjectUrl.value)
    localPreviewObjectUrl.value = null
  }
}

function clearErrors () {
  nameError.value = null
  iconError.value = null
  submitError.value = null
}

async function load () {
  const settings = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`)
  nameCurrent.value = (settings.name || '').trim()
  nameDraft.value = nameCurrent.value
  iconCurrentUrl.value = settings.icon_url || null
  iconPreviewUrl.value = iconCurrentUrl.value
  selectedIconFile.value = null
  iconResetPending.value = false
  iconImageFailed.value = false
  iconDropActive.value = false
  iconDragDepth.value = 0
  revokeLocalPreview()
  if (iconFileInputRef.value) {
    iconFileInputRef.value.value = ''
  }
  clearErrors()
}

function close () {
  if (loading.value) return
  emit('update:modelValue', false)
}

function openIconFileDialog () {
  if (loading.value) return
  iconFileInputRef.value?.click()
}

function applyIconFile (file: File | null) {
  iconError.value = null
  submitError.value = null
  if (!file) {
    return
  }
  if (!file.type.startsWith('image/')) {
    iconError.value = '画像ファイルを選択してください'
    return
  }
  revokeLocalPreview()
  selectedIconFile.value = file
  iconResetPending.value = false
  iconImageFailed.value = false
  const objectUrl = URL.createObjectURL(file)
  localPreviewObjectUrl.value = objectUrl
  iconPreviewUrl.value = objectUrl
}

function onIconFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  applyIconFile(input.files?.[0] ?? null)
}

function onIconDragEnter () {
  if (loading.value) return
  iconDragDepth.value += 1
  iconDropActive.value = true
}

function onIconDragOver () {
  if (loading.value) return
  iconDropActive.value = true
}

function onIconDragLeave () {
  iconDragDepth.value = Math.max(0, iconDragDepth.value - 1)
  if (iconDragDepth.value === 0) {
    iconDropActive.value = false
  }
}

function onIconDrop (event: DragEvent) {
  iconDragDepth.value = 0
  iconDropActive.value = false
  if (loading.value) return
  const file = event.dataTransfer?.files?.[0] ?? null
  applyIconFile(file)
}

function resetIconToDefault () {
  if (loading.value || !canResetIcon.value) return
  iconError.value = null
  submitError.value = null
  selectedIconFile.value = null
  iconResetPending.value = Boolean(iconCurrentUrl.value)
  iconImageFailed.value = false
  revokeLocalPreview()
  iconPreviewUrl.value = null
  if (iconFileInputRef.value) {
    iconFileInputRef.value.value = ''
  }
}

watch(nameDraft, () => {
  if (nameError.value) nameError.value = null
  if (submitError.value) submitError.value = null
})

async function save () {
  if (loading.value) return

  const nameValidation = requiredTextFieldError(nameDraft.value, '組織名', ORGANIZATION_NAME_MAX_LENGTH)
  nameError.value = nameValidation
  iconError.value = null
  submitError.value = null
  if (nameValidation) {
    return
  }

  const name = nameDraft.value.trim()
  loading.value = true

  try {
    let nextIconUrl: string | null = iconCurrentUrl.value

    if (iconResetPending.value) {
      try {
        const res = await api<{ icon_url: string | null }>(`/orgs/${props.orgSlug}/icon`, {
          method: 'DELETE',
        })
        nextIconUrl = res.icon_url ?? null
      } catch (e: unknown) {
        iconError.value = e instanceof Error ? e.message : 'アイコンの削除に失敗しました'
        return
      }
      iconResetPending.value = false
    } else if (selectedIconFile.value) {
      try {
        const body = new FormData()
        body.append('icon', selectedIconFile.value)
        const res = await api<{ icon_url: string | null }>(`/orgs/${props.orgSlug}/icon`, {
          method: 'POST',
          body,
        })
        nextIconUrl = res.icon_url
      } catch (e: unknown) {
        iconError.value = e instanceof Error ? e.message : 'アイコンのアップロードに失敗しました'
        return
      }
      selectedIconFile.value = null
      revokeLocalPreview()
    }

    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`, {
      method: 'PATCH',
      body: { name },
    })

    const savedName = (res.name || name).trim()
    nameCurrent.value = savedName
    nameDraft.value = savedName
    iconCurrentUrl.value = res.icon_url ?? nextIconUrl
    iconPreviewUrl.value = iconCurrentUrl.value

    emit('saved', { name: savedName, icon_url: iconCurrentUrl.value })
    emit('update:modelValue', false)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '組織設定の更新に失敗しました'
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
<style lang="scss" scoped src="~/assets/styles/components/modals/OrganizationSettingsModal.scss"></style>
