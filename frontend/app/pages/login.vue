<template>
  <AuthGateShell
    title="ログイン"
    subtitle="組織のスペースへ進むには、アカウントでサインインしてください。"
    :busy="checking"
    busy-label="ログイン状態を確認しています…"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
    <p v-if="showReauthNote" class="auth-copy">
      別のタブでログイン状態が変わりました。続けるには、もう一度ログインしてください。
    </p>
    <p v-if="showBypassNote" class="auth-copy">
      Cognito は未設定です。この環境ではバイパス認証でスペースへ進めます。
    </p>
    <button
      v-if="showCognitoLogin"
      type="button"
      class="auth-btn auth-btn--block"
      @click="startLogin(nextPath)"
    >
      Cognito でログイン
    </button>
    <button
      v-if="showRetry"
      type="button"
      class="auth-btn auth-btn--block"
      @click="retryEnter"
    >
      再試行
    </button>
    <template #footer>
      アカウントをお持ちでない方は
      <NuxtLink to="/register">アカウント作成</NuxtLink>
    </template>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { safeInternalPath } from '../utils/auth/safeInternalPath'
import { useOrganizationContext } from '../composables/org/useOrganizationContext'
import { useCurrentUser } from '../composables/auth/useCurrentUser'
import type { AuthUser } from '../composables/auth/useAuth'

definePageMeta({
  name: 'login',
  keepalive: false,
})

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
const checking = ref(true)
const authenticated = ref(false)
const loadError = ref<string | null>(null)
const resolveFailed = ref(false)
const signedInUser = ref<AuthUser | null>(null)

const reauthRequested = computed(() => route.query.reauth === '1')

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
  const value = Array.isArray(raw) ? raw[0] : raw
  return safeInternalPath(value, '/post-login')
})

const errorMessage = computed(() => {
  if (loadError.value) {
    return loadError.value
  }
  const code = typeof route.query.error === 'string' ? route.query.error : ''
  return code ? (ERROR_MESSAGES[code] ?? 'ログインに失敗しました。') : ''
})

const showReauthNote = computed(() => (
  !checking.value && reauthRequested.value && isConfigured.value && authenticated.value
))
const showBypassNote = computed(() => (
  !checking.value && !isConfigured.value && !authenticated.value
))
const showCognitoLogin = computed(() => (
  !checking.value && isConfigured.value && (!authenticated.value || reauthRequested.value)
))
const showRetry = computed(() => (
  !checking.value && resolveFailed.value && authenticated.value && !reauthRequested.value
))

async function withTimeout<T> (promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}がタイムアウトしました。しばらくしてからもう一度お試しください。`))
        }, ms)
      }),
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

/** 明示された戻り先があればそこへ、無ければ所属組織のスペース一覧へ進む */
async function enterWorkspace (sessionUser: AuthUser | null | undefined): Promise<string> {
  const requested = nextPath.value
  if (requested !== '/post-login' && requested !== '/') {
    return requested
  }
  return await withTimeout(resolvePostLoginPath(sessionUser), 8000, 'ログイン後の遷移先の取得')
}

async function continueSignedIn (sessionUser: AuthUser | null) {
  resolveFailed.value = false
  loadError.value = null
  const target = await enterWorkspace(sessionUser)
  await navigateTo(target, { replace: true })
}

async function retryEnter () {
  if (!authenticated.value) {
    return
  }
  checking.value = true
  let stayOnLogin = true
  try {
    await continueSignedIn(signedInUser.value)
    stayOnLogin = false
  } catch (e: unknown) {
    resolveFailed.value = true
    loadError.value = e instanceof Error ? e.message : 'ログイン後の画面へ進めませんでした。'
  } finally {
    if (stayOnLogin) {
      checking.value = false
    }
  }
}

onMounted(() => {
  void (async () => {
    checking.value = true
    let stayOnLogin = true
    try {
      const session = await withTimeout(fetchSession({ force: true }), 8000, 'ログイン状態の確認')
      isConfigured.value = session.configured
      authenticated.value = session.authenticated
      signedInUser.value = session.user
      setCurrentUserId(session.user?.id ?? null)
      if (!session.authenticated) {
        return
      }
      // 他タブでユーザーが変わったあとは、黙ってそのユーザーの画面へ進まない。
      if (reauthRequested.value && session.configured) {
        return
      }
      sessionStorage.removeItem('tm:pending_invite')
      await continueSignedIn(session.user)
      stayOnLogin = false
    } catch (e: unknown) {
      resolveFailed.value = authenticated.value
      loadError.value = e instanceof Error ? e.message : 'ログイン状態の確認に失敗しました'
    } finally {
      if (stayOnLogin) {
        checking.value = false
      }
    }
  })()
})
</script>
