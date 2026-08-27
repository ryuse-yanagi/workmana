<template>
  <AuthGateShell
    title="移動中"
    :subtitle="errorMessage ? 'ログイン後の画面へ進めませんでした。' : 'ログイン後の画面へ移動しています…'"
    :busy="!errorMessage"
    :busy-label="message"
  >
    <p v-if="errorMessage" class="auth-err" role="alert">{{ errorMessage }}</p>
    <NuxtLink v-if="errorMessage" to="/login" class="auth-btn auth-btn--block">
      ログイン画面へ
    </NuxtLink>
  </AuthGateShell>
</template>

<script setup lang="ts">
import { useAuth } from '../composables/useAuth'
import { useOrganizationContext } from '../composables/useOrganizationContext'

definePageMeta({
  name: 'post-login',
})

const { fetchSession } = useAuth()
const { resolvePostLoginPath } = useOrganizationContext()

const message = ref('ログイン後の画面へ移動しています…')
const errorMessage = ref('')

onMounted(async () => {
  try {
    const session = await fetchSession()
    if (!session.authenticated) {
      await navigateTo('/login')
      return
    }
    const path = await resolvePostLoginPath(session.user)
    await navigateTo(path)
  } catch (error: unknown) {
    message.value = '遷移に失敗しました。'
    errorMessage.value = error instanceof Error ? error.message : 'もう一度ログインしてください。'
  }
})
</script>
