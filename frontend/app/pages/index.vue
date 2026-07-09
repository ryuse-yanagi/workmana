<template>
  <main class="page">
    <h1>タスク管理</h1>
    <p class="muted">
      バックエンド API(Laravel)と連携します。本番導線は <NuxtLink to="/login">ログイン画面</NuxtLink> です。ローカルでは Cognito バイパス時、トークン欄にユーザー ID(数字)を入れてください。
    </p>
    <section class="card">
      <p class="muted small">API ベース: <code>{{ apiBaseDisplay }}</code></p>
      <label>API トークン(Bearer / Cognito ID トークン)</label>
      <input v-model="tokenInput" type="text" placeholder="例: 1(バイパス時)" autocomplete="off" />
      <div class="actions">
        <button type="button" @click="saveToken">保存</button>
        <button type="button" class="secondary" @click="testConnection">接続テスト(GET /me)</button>
      </div>
      <p v-if="statusMessage" class="status" :class="statusKind">{{ statusMessage }}</p>
    </section>
    <section class="card">
      <h2>ユーザーアイコン</h2>
      <p class="muted">ログイン中ユーザーのアイコン画像を設定できます（最大2MB）。</p>
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
      <p v-if="avatarMessage" class="status" :class="avatarStatusKind">{{ avatarMessage }}</p>
    </section>
    <section class="card">
      <h2>組織の URL</h2>
      <p class="muted">設計どおり <code>/org/&#123;slug&#125;/workspaces</code> で識別します。</p>
      <label>スラッグ</label>
      <div class="row">
        <input v-model="slug" type="text" placeholder="acme" />
        <NuxtLink v-if="slug.trim()" class="btn" :to="`/org/${slug.trim()}/workspaces`">開く</NuxtLink>
        <span v-else class="muted">スラッグを入力してください</span>
      </div>
    </section>
  </main>
</template>
<script setup lang="ts">
import { useApi } from '../composables/useApi'
const config = useRuntimeConfig()
const { api } = useApi()
const tokenInput = ref('')
const slug = ref('')
const statusMessage = ref('')
const statusKind = ref<'ok' | 'err'>('ok')
const avatarPreviewUrl = ref<string | null>(null)
const selectedAvatarFile = ref<File | null>(null)
const avatarUploading = ref(false)
const avatarMessage = ref('')
const avatarStatusKind = ref<'ok' | 'err'>('ok')
const apiBaseDisplay = computed(() => (config.public.apiBaseUrl as string) || '/api')
if (import.meta.client) {
  tokenInput.value = localStorage.getItem('id_token') ?? ''
}
function setStatus (msg: string, kind: 'ok' | 'err') {
  statusMessage.value = msg
  statusKind.value = kind
}
function saveToken () {
  if (!import.meta.client) {
    return
  }
  localStorage.setItem('id_token', tokenInput.value.trim())
  setStatus('ローカルに保存しました。このあと「接続テスト」か組織ページで API を呼べます。', 'ok')
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
    setAvatarStatus('選択した画像を確認して保存してください。', 'ok')
  }
}
async function testConnection () {
  if (!import.meta.client) {
    return
  }
  setStatus('確認中…', 'ok')
  try {
    const me = await api<{ email?: string; avatar_url?: string | null }>('/me')
    avatarPreviewUrl.value = me.avatar_url || null
    setStatus(`接続成功: ${me.email ?? JSON.stringify(me)}`, 'ok')
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
    setAvatarStatus('アイコンを更新しました。', 'ok')
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
    setAvatarStatus('アイコンを削除しました。', 'ok')
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
<style lang="scss" scoped>
.page { max-width: 560px; margin: 28px auto; padding: 0 14px; }
.muted { color: #64748b; font-size: 12.6px; }
.card { margin-top: 21px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; }
label { display: block; margin-bottom: 4.9px; font-weight: 600; }
input { width: 100%; padding: 7px; margin-bottom: 7px; box-sizing: border-box; }
.row { display: flex; gap: 7px; align-items: center; }
.row input { flex: 1; margin-bottom: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
button, .btn {
  padding: 7px 14px; border-radius: 6px; border: none; background: #0f172a; color: white;
  cursor: pointer; text-decoration: none; display: inline-block; font-size: 12.6px;
}
button.secondary { background: #334155; }
.status { margin-top: 10.5px; font-size: 12.6px; }
.status.ok { color: #15803d; }
.status.err { color: #b91c1c; }
.small { margin-bottom: 7px; }
code { background: #f1f5f9; padding: 1.4px 4.9px; border-radius: 4px; }
.avatar-row { display: flex; gap: 14px; align-items: center; }
.avatar-image, .avatar-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 9999px;
  border: 1px solid #cbd5e1;
}
.avatar-image { object-fit: cover; background: #fff; }
.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #f8fafc;
  font-size: 11.2px;
}
.avatar-controls { flex: 1; }
</style>
