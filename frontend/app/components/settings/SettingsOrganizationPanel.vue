<template>
  <SettingsPanel title="組織設定">
    <p v-if="canManage" class="org-icon-note">組織アイコンを設定できます。</p>
    <p v-else class="org-icon-readonly">
      組織アイコンの変更は組織管理者のみ行えます。
    </p>
    <div class="org-icon-row">
      <img
        v-if="iconPreviewUrl"
        :src="iconPreviewUrl"
        alt="組織アイコン"
        class="org-icon-image"
      />
      <div v-else class="org-icon-placeholder">No Icon</div>
      <div v-if="canManage" class="org-icon-actions">
        <input
          type="file"
          accept="image/*"
          :disabled="iconLoading"
          @change="onIconFileChange"
        />
        <p v-if="iconError" class="field-error">{{ iconError }}</p>
        <div class="settings-button-row settings-button-row--start">
          <button
            type="button"
            class="settings-primary-btn"
            :disabled="iconLoading"
            @click="uploadIcon"
          >
            アイコンを保存
          </button>
          <button
            type="button"
            class="settings-ghost-btn"
            :disabled="iconLoading || !iconPreviewUrl"
            @click="deleteIcon"
          >
            削除
          </button>
        </div>
      </div>
    </div>
    <p v-if="message" class="settings-msg">
      {{ message }}
    </p>
  </SettingsPanel>
</template>
<script setup lang="ts">
import { useApi } from '../../composables/useApi'
import { useOrgSettingsPageData } from '../../composables/useOrgSettingsPageData'
import SettingsPanel from './SettingsPanel.vue'

const props = withDefaults(defineProps<{
  orgSlug: string
  initialIconUrl?: string | null
  canManage?: boolean
}>(), {
  canManage: false,
})

const { api } = useApi()
const { getCached, patchOrgSettingsCache } = useOrgSettingsPageData()

const iconPreviewUrl = ref<string | null>(props.initialIconUrl ?? null)
const selectedIconFile = ref<File | null>(null)
const iconLoading = ref(false)
const iconError = ref<string | null>(null)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')

watch(
  () => props.initialIconUrl,
  (url) => {
    if (selectedIconFile.value) return
    iconPreviewUrl.value = url ?? null
  },
)

function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}

function notifyOrgIconUpdated (iconUrl: string | null) {
  if (!import.meta.client) return
  window.dispatchEvent(new CustomEvent('tm:org-icon-updated', {
    detail: { slug: props.orgSlug, icon_url: iconUrl },
  }))
}

function patchCachedIconUrl (iconUrl: string | null) {
  const cached = getCached(props.orgSlug)
  if (!cached) return
  patchOrgSettingsCache(props.orgSlug, {
    ...cached.orgSettings,
    icon_url: iconUrl,
  })
}

function onIconFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedIconFile.value = file
  iconError.value = null
  if (file) {
    iconPreviewUrl.value = URL.createObjectURL(file)
  }
}

async function uploadIcon () {
  if (iconLoading.value || !props.canManage) return
  if (!selectedIconFile.value) {
    iconError.value = 'アイコン画像を選択してください'
    return
  }
  iconError.value = null
  iconLoading.value = true
  setMessage('', 'ok')
  try {
    const body = new FormData()
    body.append('icon', selectedIconFile.value)
    const res = await api<{ icon_url: string | null }>(`/orgs/${props.orgSlug}/icon`, {
      method: 'POST',
      body,
    })
    iconPreviewUrl.value = res.icon_url
    selectedIconFile.value = null
    patchCachedIconUrl(res.icon_url)
    notifyOrgIconUpdated(res.icon_url)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'アイコン更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    iconLoading.value = false
  }
}

async function deleteIcon () {
  if (iconLoading.value || !props.canManage) return
  iconLoading.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/icon`, { method: 'DELETE' })
    iconPreviewUrl.value = null
    selectedIconFile.value = null
    patchCachedIconUrl(null)
    notifyOrgIconUpdated(null)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'アイコン削除に失敗しました'
    setMessage(msg, 'err')
  } finally {
    iconLoading.value = false
  }
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsOrganizationPanel.scss"></style>
