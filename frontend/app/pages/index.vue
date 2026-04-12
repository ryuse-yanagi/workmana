<template>
  <main class="page">
    <h1>タスク管理</h1>
    <p class="muted">
      バックエンド API（Laravel）と連携します。ローカルでは Cognito バイパス時、トークン欄にユーザー ID（数字）を入れてください。
    </p>
    <section class="card">
      <p class="muted small">API ベース: <code>{{ apiBaseDisplay }}</code></p>
      <label>API トークン（Bearer / Cognito ID トークン）</label>
      <input v-model="tokenInput" type="text" placeholder="例: 1（バイパス時）" autocomplete="off" />
      <div class="actions">
        <button type="button" @click="saveToken">保存</button>
        <button type="button" class="secondary" @click="testConnection">接続テスト（GET /me）</button>
      </div>
      <p v-if="statusMessage" class="status" :class="statusKind">{{ statusMessage }}</p>
    </section>
    <section class="card">
      <h2>組織の URL</h2>
      <p class="muted">設計どおり <code>/org/&#123;slug&#125;</code> で識別します。</p>
      <label>スラッグ</label>
      <div class="row">
        <input v-model="slug" type="text" placeholder="acme" />
        <NuxtLink v-if="slug.trim()" class="btn" :to="`/org/${slug.trim()}`">開く</NuxtLink>
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

async function testConnection () {
  if (!import.meta.client) {
    return
  }
  setStatus('確認中…', 'ok')
  try {
    const me = await api<{ email?: string }>('/me')
    setStatus(`接続成功: ${me.email ?? JSON.stringify(me)}`, 'ok')
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : String(e)
    setStatus(`接続失敗: ${msg}（Laravel を php artisan serve しているか確認）`, 'err')
  }
}
</script>

<style scoped>
.page { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; }
.muted { color: #64748b; font-size: 0.9rem; }
.card { margin-top: 1.5rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
label { display: block; margin-bottom: 0.35rem; font-weight: 600; }
input { width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; box-sizing: border-box; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.row input { flex: 1; margin-bottom: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
button, .btn {
  padding: 0.5rem 1rem; border-radius: 6px; border: none; background: #0f172a; color: white;
  cursor: pointer; text-decoration: none; display: inline-block; font-size: 0.9rem;
}
button.secondary { background: #334155; }
.status { margin-top: 0.75rem; font-size: 0.9rem; }
.status.ok { color: #15803d; }
.status.err { color: #b91c1c; }
.small { margin-bottom: 0.5rem; }
code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; }
</style>
