<template>
  <main class="page">
    <h1>ログイン処理中</h1>
    <p class="muted">{{ message }}</p>
    <NuxtLink v-if="error" class="link" to="/login">ログイン画面へ戻る</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const message = ref('トークンを確認しています…')
const error = ref(false)
const { readIdTokenFromHash, readStateFromHash, setToken } = useAuth()

onMounted(async () => {
  const token = readIdTokenFromHash()
  if (!token) {
    error.value = true
    message.value = 'ID トークンを受け取れませんでした。もう一度ログインしてください。'
    return
  }

  setToken(token)
  message.value = 'ログインに成功しました。組織ページへ移動します…'
  const next = readStateFromHash()
  const target = next.startsWith('/') ? next : '/org/acme'
  await navigateTo(target)
})
</script>

<style scoped>
.page { max-width: 32rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; }
.muted { color: #475569; }
.link { display: inline-block; margin-top: 0.75rem; color: #1d4ed8; }
</style>
