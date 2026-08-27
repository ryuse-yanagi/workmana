<template>
  <AuthGateShell
    title="ログイン"
    subtitle="組織のスペースへ進むには、アカウントでサインインしてください。"
    :busy="checking"
    busy-label="ログイン状態を確認しています…"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
    <p v-if="!isConfigured" class="auth-err" role="alert">
      Cognito 設定が不足しています。バックエンドの COGNITO_* を設定してください。
    </p>
    <button
      type="button"
      class="auth-btn auth-btn--block"
      :disabled="!isConfigured"
      @click="startLogin(nextPath)"
    >
      Cognito でログイン
    </button>
    <template #footer>
      アカウントをお持ちでない方は
      <NuxtLink to="/register">アカウント作成</NuxtLink>
    </template>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { safeInternalPath } from '../utils/safeInternalPath'
import { useOrganizationContext } from '../composables/useOrganizationContext'

const route = useRoute()
const { startLogin, fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()

const ERROR_MESSAGES: Record<string, string> = {
  cognito_not_configured: 'Cognito の設定が未完了のためログインできません。',
  cognito_denied: 'Cognito 側でログインが中断されました。',
  invalid_callback: 'ログイン応答が不正でした。もう一度お試しください。',
  state_mismatch: 'ログインの有効期限が切れました。もう一度お試しください。',
  login_failed: 'ログインに失敗しました。もう一度お試しください。',
}

const isConfigured = ref(true)
const checking = ref(true)
const loadError = ref<string | null>(null)

const nextPath = computed(() => {
  const raw = route.query.next
  if (raw === undefined || raw === null || raw === '') {
    if (import.meta.client) {
      const pending = sessionStorage.getItem('tm:pending_invite')
      if (pending && pending.startsWith('/invite/')) {
        return pending
      }
    }
    return '/post-login'
  }
  return safeInternalPath(raw, '/post-login')
})

const errorMessage = computed(() => {
  if (loadError.value) {
    return loadError.value
  }
  const code = typeof route.query.error === 'string' ? route.query.error : ''
  return code ? (ERROR_MESSAGES[code] ?? 'ログインに失敗しました。') : ''
})

onMounted(async () => {
  try {
    const session = await fetchSession()
    isConfigured.value = session.configured
    if (session.authenticated) {
      if (import.meta.client) {
        sessionStorage.removeItem('tm:pending_invite')
      }
      if (nextPath.value === '/post-login' || nextPath.value === '/') {
        const path = await resolvePostLoginPath(session.user)
        await navigateTo(path)
        return
      }
      await navigateTo(nextPath.value)
      return
    }
    checking.value = false
  } catch (e: unknown) {
    checking.value = false
    loadError.value = e instanceof Error ? e.message : 'ログイン状態の確認に失敗しました'
  }
})
</script>
