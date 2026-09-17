<template>
  <main class="page">
    <h1>業務管理</h1>
    <p class="muted">
      バックエンド API(Laravel)と連携します。ログインは <NuxtLink to="/login">ログイン画面</NuxtLink> から行います。認証は HttpOnly Cookie で管理されるため、ブラウザにトークンを保存する必要はありません。
    </p>
    <section class="card">
      <p class="muted small">API ベース: <code>{{ apiBaseDisplay }}</code></p>
      <div class="actions">
        <button type="button" class="secondary" @click="testConnection">接続テスト(GET /me)</button>
      </div>
      <p v-if="statusMessage && statusKind === 'err'" class="status err">{{ statusMessage }}</p>
    </section>
    <section class="card">
      <h2>ユーザーアイコン</h2>
      <p class="muted">ログイン中ユーザーのアイコン画像を設定できます(最大2MB)</p>
      <div class="avatar-row">
        <img
          v-if="avatarPreviewUrl"
          :src="avatarPreviewUrl"
          alt="ユーザーアイコン"
          class="avatar-image"
        />
        <div v-else class="avatar-placeholder">No Icon</div>
        <div class="avatar-controls">
          <input type="file" accept="image/*" @change="onAvatarFileChange" />
          <div class="actions">
            <button type="button" :disabled="avatarUploading || !selectedAvatarFile" @click="uploadAvatar">
              {{ avatarUploading ? 'アップロード中...' : 'アイコンを保存' }}
            </button>
            <button type="button" class="secondary" :disabled="avatarUploading || !avatarPreviewUrl" @click="deleteAvatar">
              アイコンを削除
            </button>
          </div>
        </div>
      </div>
      <p v-if="avatarMessage && avatarStatusKind === 'err'" class="status err">{{ avatarMessage }}</p>
    </section>
    <section class="card">
      <h2>組織の URL</h2>
      <p class="muted">設計どおり <code>/org/&#123;slug&#125;/workspaces</code> で識別します。</p>
      <label>スラッグ</label>
      <div class="row">
        <input
          v-model="slug"
          type="text"
          placeholder="acme"
          @keydown.enter.prevent="openWorkspace"
        >
        <NuxtLink
          class="btn"
          :to="workspaceHref"
          :class="{ 'is-disabled': !slug.trim() }"
          :aria-disabled="!slug.trim() ? 'true' : undefined"
        >
          開く
        </NuxtLink>
      </div>
      <p v-if="!slug.trim()" class="muted small">スラッグを入力すると「開く」が有効になります。</p>
    </section>
  </main>
</template>
<script setup lang="ts">
import { useApi } from '../composables/useApi'
const config = useRuntimeConfig()
const { api } = useApi()
const slug = ref('abcde')
const workspaceHref = computed(() => {
  const value = slug.value.trim()
  return value ? `/org/${value}/workspaces` : '/login'
})
const statusMessage = ref('')
const statusKind = ref<'ok' | 'err'>('ok')
const avatarPreviewUrl = ref<string | null>(null)
const selectedAvatarFile = ref<File | null>(null)
const avatarUploading = ref(false)
const avatarMessage = ref('')
const avatarStatusKind = ref<'ok' | 'err'>('ok')
const apiBaseDisplay = computed(() => (config.public.apiBaseUrl as string) || '/api')
function openWorkspace () {
  const value = slug.value.trim()
  if (!value) {
    return
  }
  return navigateTo(`/org/${value}/workspaces`)
}
function setStatus (msg: string, kind: 'ok' | 'err') {
  statusMessage.value = msg
  statusKind.value = kind
}
function setAvatarStatus (msg: string, kind: 'ok' | 'err') {
  avatarMessage.value = msg
  avatarStatusKind.value = kind
}
function onAvatarFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedAvatarFile.value = file
  if (file) {
    avatarPreviewUrl.value = URL.createObjectURL(file)
  }
}
async function testConnection () {
  if (!import.meta.client) {
    return
  }
  setStatus('', 'ok')
  try {
    const me = await api<{ email?: string; avatar_url?: string | null }>('/me')
    avatarPreviewUrl.value = me.avatar_url || null
    setStatus('', 'ok')
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : String(e)
    setStatus(`接続失敗: ${msg}(Laravel を php artisan serve しているか確認)`, 'err')
  }
}
async function uploadAvatar () {
  if (!selectedAvatarFile.value) {
    return
  }
  avatarUploading.value = true
  setAvatarStatus('', 'ok')
  try {
    const body = new FormData()
    body.append('avatar', selectedAvatarFile.value)
    const res = await api<{ avatar_url: string | null }>('/me/avatar', {
      method: 'POST',
      body,
    })
    avatarPreviewUrl.value = res.avatar_url
    selectedAvatarFile.value = null
    setAvatarStatus('', 'ok')
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : String(e)
    setAvatarStatus(`アップロード失敗: ${msg}`, 'err')
  } finally {
    avatarUploading.value = false
  }
}
async function deleteAvatar () {
  avatarUploading.value = true
  setAvatarStatus('', 'ok')
  try {
    await api('/me/avatar', {
      method: 'DELETE',
    })
    avatarPreviewUrl.value = null
    selectedAvatarFile.value = null
    setAvatarStatus('', 'ok')
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : String(e)
    setAvatarStatus(`削除失敗: ${msg}`, 'err')
  } finally {
    avatarUploading.value = false
  }
}
</script>
<style lang="scss" scoped src="~/assets/styles/pages/index.scss"></style>
