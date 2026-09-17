<template>
  <AuthGateShell
    title="ログイン"
    subtitle="組織のスペースへ進むには、アカウントでサインインしてください。"
    :busy="checking"
    busy-label="ログイン状態を確認しています…"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
    <p v-if="!isConfigured" class="auth-copy">
      Cognito は未設定です。この環境ではバイパス認証でスペースへ進めます。
    </p>
    <a
      class="auth-btn auth-btn--block"
      :href="continueHref"
    >
      スペース一覧へ進む
    </a>
    <button
      v-if="isConfigured"
      type="button"
      class="auth-btn auth-btn--block auth-btn--secondary"
      style="margin-top: 12px"
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
import { useCurrentUser } from '../composables/useCurrentUser'
import type { AuthUser } from '../composables/useAuth'

definePageMeta({
  name: 'login',
  keepalive: false,
})

const DEFAULT_WORKSPACE_PATH = '/org/abcde/workspaces'

const route = useRoute()
const { startLogin, fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()
const { setCurrentUserId } = useCurrentUser()

const ERROR_MESSAGES: Record<string, string> = {
  cognito_not_configured: 'Cognito の設定が未完了のためログインできません。',
  cognito_denied: 'Cognito 側でログインが中断されました。',
  invalid_callback: 'ログイン応答が不正でした。もう一度お試しください。',
  state_mismatch: 'ログインの有効期限が切れました。もう一度お試しください。',
  login_failed: 'ログインに失敗しました。もう一度お試しください。',
}

const isConfigured = ref(false)
const checking = ref(false)
const loadError = ref<string | null>(null)
const continueHref = ref(DEFAULT_WORKSPACE_PATH)

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

async function withTimeout<T> (promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}がタイムアウトしました。API（:8000）と DB が起動しているか確認してください。`))
        }, ms)
      }),
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

async function enterWorkspace (sessionUser: AuthUser | null | undefined): Promise<string> {
  const requested = nextPath.value
  if (requested !== '/post-login' && requested !== '/') {
    return requested
  }
  try {
    return await withTimeout(resolvePostLoginPath(sessionUser), 8000, 'ログイン後の遷移先の取得')
  } catch {
    return DEFAULT_WORKSPACE_PATH
  }
}

onMounted(() => {
  const failsafe = window.setTimeout(() => {
    checking.value = false
  }, 4000)

  void (async () => {
    checking.value = true
    try {
      const session = await withTimeout(fetchSession(), 8000, 'ログイン状態の確認')
      isConfigured.value = session.configured
      setCurrentUserId(session.user?.id ?? null)
      if (!session.authenticated) {
        return
      }
      sessionStorage.removeItem('tm:pending_invite')
      const target = await enterWorkspace(session.user)
      continueHref.value = target
      checking.value = false
      await navigateTo(target, { replace: true })
    } catch (e: unknown) {
      loadError.value = e instanceof Error ? e.message : 'ログイン状態の確認に失敗しました'
    } finally {
      window.clearTimeout(failsafe)
      checking.value = false
    }
  })()
})
</script>
