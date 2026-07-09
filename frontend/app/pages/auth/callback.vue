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
  const target = next.startsWith('/') ? next : '/org/acme/workspaces'
  await navigateTo(target)
})
</script>
<style lang="scss" scoped>
.page { max-width: 448px; margin: 28px auto; padding: 0 14px; }
.muted { color: mixin.$text-sub; }
.link { display: inline-block; margin-top: 10.5px; color: #1d4ed8; }
</style>
