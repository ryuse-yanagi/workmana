<template>
  <AuthGateShell
    title="移動中"
    :subtitle="errorMessage ? 'ログイン後の画面へ進めませんでした。' : 'ログイン後の画面へ移動しています…'"
    :busy="!errorMessage && checking"
    :busy-label="message"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
    <button
      v-if="errorMessage"
      type="button"
      class="auth-btn auth-btn--block"
      @click="retry"
    >
      再試行
    </button>
    <NuxtLink v-if="errorMessage" to="/login" class="auth-btn auth-btn--block auth-btn--secondary" style="margin-top: 12px">
      ログイン画面へ
    </NuxtLink>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useAuth } from '../composables/auth/useAuth'
import { useOrganizationContext } from '../composables/org/useOrganizationContext'
import { useCurrentUser } from '../composables/auth/useCurrentUser'

definePageMeta({
  name: 'post-login',
  keepalive: false,
})

const { fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()
const { setCurrentUserId } = useCurrentUser()

const message = ref('ログイン後の画面へ移動しています…')
const errorMessage = ref('')
const checking = ref(true)

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

async function continueAfterLogin () {
  checking.value = true
  errorMessage.value = ''
  message.value = 'ログイン後の画面へ移動しています…'
  let stay = false
  try {
    const session = await withTimeout(fetchSession({ force: true }), 8000, 'ログイン状態の確認')
    setCurrentUserId(session.user?.id ?? null)
    if (!session.authenticated) {
      stay = true
      await navigateTo('/login')
      return
    }
    const path = await withTimeout(resolvePostLoginPath(session.user), 8000, '遷移先の取得')
    await navigateTo(path, { replace: true })
  } catch (error: unknown) {
    stay = true
    message.value = '遷移に失敗しました。'
    errorMessage.value = error instanceof Error ? error.message : 'もう一度ログインしてください。'
  } finally {
    if (stay) {
      checking.value = false
    }
  }
}

function retry () {
  void continueAfterLogin()
}

onMounted(() => {
  void continueAfterLogin()
})
</script>
