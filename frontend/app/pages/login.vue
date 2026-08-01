<template>
  <main class="page">
    <h1>ログイン</h1>
    <p class="muted">
      組織ページへ進むには、Cognito でログインしてください。
    </p>
    <section class="card">
      <p v-if="errorMessage" class="err">
        {{ errorMessage }}
      </p>
      <p v-if="!checking && !isConfigured" class="err">
        Cognito 設定が不足しています。バックエンドの `COGNITO_*` を設定してください。
      </p>
      <button type="button" :disabled="checking || !isConfigured" @click="startLogin(nextPath)">
        Cognito でログイン
      </button>
      <p class="footer-link">
        アカウントをお持ちでない方は
        <NuxtLink to="/register">アカウント作成</NuxtLink>
      </p>
    </section>
  </main>
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
  const code = typeof route.query.error === 'string' ? route.query.error : ''
  return code ? (ERROR_MESSAGES[code] ?? 'ログインに失敗しました。') : ''
})

onMounted(async () => {
  const session = await fetchSession()
  isConfigured.value = session.configured
  checking.value = false
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
  }
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/login.scss"></style>
<style lang="scss" scoped>
.footer-link {
  margin-top: 14px;
  font-size: 12.6px;
  color: #64748b;
}
.footer-link a {
  color: #0f2945;
  font-weight: 700;
}
button { display: block; }
</style>
