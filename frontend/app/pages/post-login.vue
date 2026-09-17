<template>
  <AuthGateShell
    title="移動中"
    :subtitle="errorMessage ? 'ログイン後の画面へ進めませんでした。' : 'ログイン後の画面へ移動しています…'"
    :busy="!errorMessage && checking"
    :busy-label="message"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
    <a class="auth-btn auth-btn--block" :href="continueHref">
      スペース一覧へ進む
    </a>
    <NuxtLink v-if="errorMessage" to="/login" class="auth-btn auth-btn--block auth-btn--secondary" style="margin-top: 12px">
      ログイン画面へ
    </NuxtLink>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useAuth } from '../composables/useAuth'
import { useOrganizationContext } from '../composables/useOrganizationContext'
import { useCurrentUser } from '../composables/useCurrentUser'

definePageMeta({
  name: 'post-login',
  keepalive: false,
})

const DEFAULT_WORKSPACE_PATH = '/org/abcde/workspaces'

const { fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()
const { setCurrentUserId } = useCurrentUser()

const message = ref('ログイン後の画面へ移動しています…')
const errorMessage = ref('')
const checking = ref(false)
const continueHref = ref(DEFAULT_WORKSPACE_PATH)

async function withTimeout<T> (promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}がタイムアウトしました。API と DB の起動を確認してください。`))
        }, ms)
      }),
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
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
      setCurrentUserId(session.user?.id ?? null)
      if (!session.authenticated) {
        await navigateTo('/login')
        return
      }
      const path = await withTimeout(resolvePostLoginPath(session.user), 8000, '遷移先の取得')
      continueHref.value = path
      checking.value = false
      await navigateTo(path, { replace: true })
    } catch (error: unknown) {
      message.value = '遷移に失敗しました。'
      errorMessage.value = error instanceof Error ? error.message : 'もう一度ログインしてください。'
    } finally {
      window.clearTimeout(failsafe)
      checking.value = false
    }
  })()
})
</script>
