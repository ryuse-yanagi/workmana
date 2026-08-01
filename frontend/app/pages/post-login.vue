<template>
  <main class="page">
    <h1>移動中…</h1>
    <section class="card">
      <p class="muted">{{ message }}</p>
      <p v-if="errorMessage" class="err">{{ errorMessage }}</p>
    </section>
  </main>
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

<style lang="scss" scoped src="~/assets/styles/pages/invite.scss"></style>
